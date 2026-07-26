/**
 * GreenLight read/ingest API.
 *
 * Handlers validate input, authorise, and either read persisted state or
 * enqueue work. Long-running integration work belongs to the worker, so an
 * API restart can never lose accepted work.
 */
import { randomUUID } from "node:crypto";
import { FastifyOtelInstrumentation } from "@fastify/otel";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { signozPublicUrl, type AppConfig } from "./config.js";
import { createRepositories } from "./db/store.js";
import type { Repositories } from "./db/repositories/index.js";
import { authenticate, hasScope, type Principal, type Scope } from "./http/auth.js";
import { AppError } from "./http/errors.js";
import {
  CommitShaParamsSchema,
  DeploymentBodySchema,
  EvaluationBodySchema,
  JobParamsSchema,
  SyncLatestBodySchema,
  SignozAlertNotificationSchema,
  SyncRunsBodySchema,
  parseInput,
} from "./http/schemas.js";
import { listChangeSummaries } from "./modules/changes/service.js";
import { GitHubClient, GitHubClientError } from "./modules/github/client.js";
import { PrimaryWorkflowConfigurationError } from "./modules/github/primary-workflow.js";
import { getReceipt } from "./modules/receipts/assembler.js";
import { BaselineRequiredError } from "./modules/regressions/baseline-resolver.js";
import { SignozClient, SignozIntegrationError } from "./modules/signoz/client.js";
import { recordAlertNotification, registerRuntimeMetrics } from "./observability/metrics.js";
import { createOtelLogStream } from "./observability/otel-log-stream.js";
export interface ServerDependencies {
  repos?: Repositories;
  signoz?: SignozClient;
  github?: GitHubClient;
}

export async function buildServer(config: AppConfig, dependencies: ServerDependencies = {}) {
  const repos = dependencies.repos ??
    await createRepositories({
    databasePath: config.GREENLIGHT_DATABASE_PATH,
    connectionUrl: config.GREENLIGHT_DATABASE_URL,
  });
  const signoz = dependencies.signoz ??
    new SignozClient(config.SIGNOZ_URL, config.SIGNOZ_API_KEY, {
      maxAttempts: config.SIGNOZ_QUERY_MAX_ATTEMPTS,
      requestTimeoutMs: config.SIGNOZ_QUERY_TIMEOUT_MS,
      deploymentDashboardId: config.SIGNOZ_DEPLOYMENT_DASHBOARD_ID,
      publicBaseUrl: signozPublicUrl(config),
    });
  const github = dependencies.github ??
    new GitHubClient({ token: config.GITHUB_TOKEN, repository: config.GITHUB_REPOSITORY });

  // The same checks the dependency endpoint reports, observed on the export
  // interval so a degraded dependency is visible in SigNoz without anyone
  // having to call the endpoint.
  registerRuntimeMetrics({
    countJobsByState: () => repos.countJobsByState(),
    checkDependencies: async () => {
      const [githubUp, signozUp, databaseUp] = await Promise.all([
        github.checkHealth(),
        signoz.checkHealth(),
        repos.ping(),
      ]);
      return { github: githubUp, signoz: signozUp, database: databaseUp };
    },
  });

  const app = Fastify({
    logger: {
      level: config.GREENLIGHT_LOG_LEVEL,
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "res.headers['set-cookie']",
          "*.token",
          "*.apiKey",
          "*.password",
        ],
        censor: "[redacted]",
      },
      // Redaction is applied by pino before the record reaches this stream, so
      // what is forwarded to SigNoz is already censored.
      stream: createOtelLogStream({ service: config.OTEL_SERVICE_NAME }),
    },
    bodyLimit: config.GREENLIGHT_BODY_LIMIT_BYTES,
    requestTimeout: config.GREENLIGHT_REQUEST_TIMEOUT_MS,
    genReqId: () => randomUUID(),
  });

  // Registered explicitly rather than through OpenTelemetry's monkey-patching
  // Fastify instrumentation, which cannot intercept an ESM `import` of Fastify
  // and therefore left every span named `GET` with no `http.route`. The plugin
  // names spans after the matched route template, which is what the SigNoz
  // dashboards and service map group by.
  await app.register(
    new FastifyOtelInstrumentation({
      // Matches the HTTP instrumentation's probe filter so readiness polling
      // does not dominate trace volume.
      ignorePaths: ({ url }) => ["/livez", "/readyz"].includes(url),
      // One span per matched route is the useful unit; a span per lifecycle
      // hook would multiply volume without adding diagnostic value.
      instrumentHooks: false,
    }).plugin(),
  );

  const allowedOrigins = new Set(config.GREENLIGHT_ALLOWED_ORIGINS);
  const rateBuckets = new Map<string, { minute: number; count: number }>();
  const activeRequests = new Set<string>();
  let concurrentRequests = 0;

  app.addHook("onRequest", async (request, reply) => {
    const origin = request.headers.origin;
    if (origin) {
      if (!allowedOrigins.has(origin)) {
        return reply.status(403).send({ error: "origin_forbidden", requestId: request.id });
      }
      reply.header("Access-Control-Allow-Origin", origin);
      reply.header("Vary", "Origin");
      reply.header("Access-Control-Allow-Headers", "Authorization, Content-Type");
      reply.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      // The web client reads with the browser's own session rather than a
      // token compiled into its bundle, so credentialed cross-origin reads
      // must be permitted for the origins on the allowlist.
      reply.header("Access-Control-Allow-Credentials", "true");
    }
    if (request.method === "OPTIONS") {
      return reply.status(204).send();
    }

    const minute = Math.floor(Date.now() / 60_000);
    const bucket = rateBuckets.get(request.ip);
    const next = bucket && bucket.minute === minute
      ? { minute, count: bucket.count + 1 }
      : { minute, count: 1 };
    rateBuckets.set(request.ip, next);
    if (rateBuckets.size > 10_000) {
      for (const [key, value] of rateBuckets) {
        if (value.minute !== minute) {
          rateBuckets.delete(key);
        }
      }
    }
    if (next.count > config.GREENLIGHT_RATE_LIMIT_PER_MINUTE) {
      return reply.status(429).send({ error: "rate_limit_exceeded", requestId: request.id });
    }

    if (concurrentRequests >= config.GREENLIGHT_MAX_CONCURRENT_REQUESTS) {
      return reply.status(503).send({ error: "concurrency_limit_exceeded", requestId: request.id });
    }
    concurrentRequests += 1;
    activeRequests.add(request.id);
  });

  app.addHook("onResponse", async (request) => {
    if (activeRequests.delete(request.id)) {
      concurrentRequests = Math.max(0, concurrentRequests - 1);
    }
  });

  app.setErrorHandler((error, request, reply) => {
    const mapped = mapError(error);
    // Client mistakes are not system faults: logging them at error level and
    // marking their spans failed would make every dashboard read as an outage.
    if (mapped.statusCode >= 500) {
      request.log.error({ err: error, requestId: request.id }, "request failed");
    } else {
      request.log.warn(
        { err_code: mapped.body.error, requestId: request.id },
        "request rejected",
      );
    }
    return reply.status(mapped.statusCode).send({ ...mapped.body, requestId: request.id });
  });

  function authorize(request: FastifyRequest, reply: FastifyReply, scope: Scope): Principal | null {
    if (scope === "read" && !config.GREENLIGHT_REQUIRE_READ_AUTH) {
      return { id: "anonymous", scopes: ["read"] };
    }
    const principal = authenticate(request.headers.authorization, config);
    if (!principal) {
      reply.status(401).send({ error: "unauthorized", requestId: request.id });
      return null;
    }
    if (!hasScope(principal, scope)) {
      reply.status(403).send({ error: "forbidden", requestId: request.id });
      return null;
    }
    return principal;
  }

  function enqueueWork(
    request: FastifyRequest,
    principal: Principal,
    kind: "github_sync_runs" | "github_sync_latest" | "deployment_record" | "regression_evaluate",
    payload: unknown,
  ) {
    return repos.transaction(async (tx) => {
      const job = await tx.enqueueJob({
        id: `job_${randomUUID()}`,
        kind,
        payload_json: JSON.stringify(payload),
      });
      await tx.insertAuditEvent({
        id: `audit_${randomUUID()}`,
        actor_id: principal.id,
        action: `enqueue.${kind}`,
        resource_type: "job",
        resource_id: job.id,
        request_id: request.id,
        details_json: JSON.stringify({ kind }),
        created_at: new Date().toISOString(),
      });
      return job;
    });
  }

  app.get("/livez", async () => ({ status: "alive" }));

  app.get("/readyz", async (_request, reply) => {
    const ready = await repos.ping();
    return reply.status(ready ? 200 : 503).send({
      status: ready ? "ready" : "not_ready",
      checks: { database: ready ? "ok" : "failed" },
    });
  });

  app.get("/api/v1/health", async (_request, reply) => {
    const ready = await repos.ping();
    return reply.status(ready ? 200 : 503).send({
      status: ready ? "ready" : "not_ready",
      checks: { database: ready ? "ok" : "failed" },
    });
  });

  app.get("/api/v1/status/dependencies", async (request, reply) => {
    if (!authorize(request, reply, "read")) {
      return;
    }
    const [github_, signoz_, database] = await Promise.all([
      github.checkHealth(),
      signoz.checkHealth(),
      repos.ping(),
    ]);
    const healthy = database && github_ && signoz_;
    return reply.status(healthy ? 200 : 503).send({
      status: healthy ? "ok" : "degraded",
      checks: {
        database: database ? "ok" : "failed",
        github: github_ ? "ok" : "failed",
        signoz: signoz_ ? "ok" : "failed",
      },
    });
  });

  app.get("/api/v1/changes", async (request, reply) => {
    if (!authorize(request, reply, "read")) {
      return;
    }
    const changes = await repos.listChanges(20);
    // Each change needs its pipelines and deployments; fetching them together
    // keeps the response one round of concurrent reads rather than a
    // sequential walk per change.
    const [pipelines, deployments] = await Promise.all([
      Promise.all(changes.map((change) => repos.getPipelineRunsForChange(change.id))),
      Promise.all(changes.map((change) => repos.getDeploymentsForChange(change.id))),
    ]);
    const pipelinesByChange = new Map(
      changes.map((change, index) => [change.id, pipelines[index]]),
    );
    const deploymentsByChange = new Map(
      changes.map((change, index) => [change.id, deployments[index]]),
    );
    // A summary reports the most recent deployment only, so only those
    // deployments' verdicts are read — and they are read concurrently, because
    // one query per deployment in series is what makes this list slow.
    const summarised = deployments
      .map((forChange) => forChange[0])
      .filter((deployment) => deployment !== undefined);
    const evaluations = await Promise.all(
      summarised.map((deployment) => repos.getLatestEvaluationForDeployment(deployment.id)),
    );
    const evaluationsByDeployment = new Map(
      summarised.flatMap((deployment, index) => {
        const evaluation = evaluations[index];
        return evaluation ? [[deployment.id, evaluation] as const] : [];
      }),
    );
    return {
      changes: listChangeSummaries(
        changes,
        pipelinesByChange,
        deploymentsByChange,
        evaluationsByDeployment,
      ),
    };
  });

  app.get("/api/v1/changes/:commitSha", async (request, reply) => {
    if (!authorize(request, reply, "read")) {
      return;
    }
    const params = parseInput(CommitShaParamsSchema, request.params);
    const receipt = await getReceipt(
      repos,
      config.GITHUB_REPOSITORY,
      signozPublicUrl(config),
      params.commitSha,
      async ({ traceId, spanId, committedAt }) => {
        const anchor = committedAt ? Date.parse(committedAt) : Date.now();
        const dayMs = 24 * 60 * 60 * 1_000;
        try {
          const session = await signoz.fetchAiSessionPrompts({
            traceId,
            spanId,
            serviceName: config.CLAUDE_OTEL_SERVICE_NAME,
            startMs: Math.max(0, anchor - dayMs),
            endMs: anchor + dayMs,
          });
          return { ...session, promptsRecorded: session.prompts.length > 0 };
        } catch (error) {
          // A receipt whose evidence chain is intact must not 500 because the
          // trace store is briefly unavailable, so the session reads as
          // unanswered rather than as a session that recorded nothing.
          if (error instanceof SignozIntegrationError) {
            request.log.warn({ err: error, traceId }, "ai session prompts unavailable");
            return null;
          }
          throw error;
        }
      },
    );
    if (!receipt) {
      return reply.status(404).send({ error: "not_found", requestId: request.id });
    }
    return receipt;
  });

  app.post("/api/v1/github/sync-runs", async (request, reply) => {
    const principal = authorize(request, reply, "sync");
    if (!principal) {
      return;
    }
    const body = parseInput(SyncRunsBodySchema, request.body);
    assertConfiguredRepository(body.repository, config.GITHUB_REPOSITORY);
    const job = await enqueueWork(request, principal, "github_sync_runs", body);
    return reply.status(202).send({ jobId: job.id, state: job.state });
  });

  app.post("/api/v1/github/sync-latest", async (request, reply) => {
    const principal = authorize(request, reply, "sync");
    if (!principal) {
      return;
    }
    const body = parseInput(SyncLatestBodySchema, request.body);
    assertConfiguredRepository(body.repository, config.GITHUB_REPOSITORY);
    const job = await enqueueWork(request, principal, "github_sync_latest", body);
    return reply.status(202).send({ jobId: job.id, state: job.state });
  });

  app.post("/api/v1/deployments", async (request, reply) => {
    const principal = authorize(request, reply, "deploy");
    if (!principal) {
      return;
    }
    const body = parseInput(DeploymentBodySchema, request.body);
    assertConfiguredRepository(body.repository, config.GITHUB_REPOSITORY);
    const job = await enqueueWork(request, principal, "deployment_record", body);
    return reply.status(202).send({ jobId: job.id, state: job.state });
  });

  app.post("/api/v1/regressions/evaluate", async (request, reply) => {
    const principal = authorize(request, reply, "evaluate");
    if (!principal) {
      return;
    }
    const body = parseInput(EvaluationBodySchema, request.body);
    const job = await enqueueWork(request, principal, "regression_evaluate", body);
    return reply.status(202).send({ jobId: job.id, state: job.state });
  });

  /**
   * Receives alert notifications from SigNoz.
   *
   * SigNoz refuses to store a rule that has no notification channel, so a
   * webhook pointed here is what makes GreenLight's alert rules importable at
   * all. It also closes a real loop: the same system that decides verdicts from
   * SigNoz telemetry learns when SigNoz's own guardrails fired, and each
   * notification is logged with trace context so it lands back in SigNoz beside
   * the spans that triggered it.
   *
   * SigNoz's webhook channel authenticates with a username and password and
   * sends no custom headers, so this route is reached with basic auth carrying
   * a scoped API key. It records and acknowledges; it never decides anything.
   */
  app.post("/api/v1/integrations/signoz/alerts", async (request, reply) => {
    if (!authorize(request, reply, "notify")) {
      return;
    }
    const body = parseInput(SignozAlertNotificationSchema, request.body);
    for (const alert of body.alerts) {
      const alertName = alert.labels.alertname ?? "unnamed";
      recordAlertNotification({ alertName, status: alert.status });
      request.log.info({
        alert_name: alertName,
        alert_status: alert.status,
        severity: alert.labels.severity,
        service_name: alert.labels["service.name"],
        starts_at: alert.startsAt,
        ends_at: alert.endsAt,
      }, "signoz alert notification received");
    }
    return reply.status(202).send({ received: body.alerts.length });
  });

  app.get("/api/v1/jobs/:jobId", async (request, reply) => {
    if (!authorize(request, reply, "read")) {
      return;
    }
    const params = parseInput(JobParamsSchema, request.params);
    const job = await repos.getJob(params.jobId);
    if (!job) {
      return reply.status(404).send({ error: "not_found", requestId: request.id });
    }
    return {
      id: job.id,
      kind: job.kind,
      state: job.state,
      attempts: job.attempts,
      lastError: job.last_error,
      result: job.result_json ? JSON.parse(job.result_json) : null,
      updatedAt: job.updated_at,
    };
  });

  app.addHook("onClose", async () => {
    await repos.close();
  });

  return app;
}

interface MappedError {
  statusCode: number;
  body: { error: string; message: string; retryable?: boolean };
}

/** Single place where a domain error becomes an HTTP response. */
function mapError(error: unknown): MappedError {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      body: { error: error.code, message: error.message, retryable: error.retryable },
    };
  }
  if (error instanceof BaselineRequiredError) {
    return { statusCode: 409, body: { error: "baseline_required", message: error.message } };
  }
  if (error instanceof PrimaryWorkflowConfigurationError) {
    return {
      statusCode: 409,
      body: { error: "primary_workflow_ambiguous", message: error.message },
    };
  }
  if (error instanceof GitHubClientError) {
    return {
      statusCode: error.retryable ? 503 : 502,
      body: {
        error: "github_dependency_error",
        message: error.message,
        retryable: error.retryable,
      },
    };
  }
  if (error instanceof SignozIntegrationError) {
    return {
      statusCode: error.retryable ? 503 : 502,
      body: { error: error.code, message: error.message, retryable: error.retryable },
    };
  }
  if (
    error !== null &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof (error as { statusCode: unknown }).statusCode === "number" &&
    (error as { statusCode: number }).statusCode < 500
  ) {
    const fastifyError = error as { statusCode: number; code?: string; message: string };
    return {
      statusCode: fastifyError.statusCode,
      body: {
        error: fastifyError.code?.toLowerCase() ?? "bad_request",
        message: fastifyError.message,
      },
    };
  }
  return {
    statusCode: 500,
    body: { error: "internal_error", message: "The request could not be completed" },
  };
}

function assertConfiguredRepository(requested: string | undefined, configured: string) {
  if (requested && requested !== configured) {
    throw new AppError(
      "repository_not_configured",
      "The requested repository is not configured for this GreenLight instance",
      400,
    );
  }
}
