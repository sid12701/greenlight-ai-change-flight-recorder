import Fastify from "fastify";
import type { AppConfig } from "./config.js";
import { createDatabase } from "./db/migrate.js";
import { Repositories } from "./db/repositories/index.js";
import type { DeploymentRow } from "./db/repositories/index.js";
import { DeploymentService } from "./modules/deployments/service.js";
import { listChangeSummaries } from "./modules/changes/service.js";
import { getReceipt } from "./modules/receipts/assembler.js";
import { evaluateRegression, DEFAULT_THRESHOLDS } from "./modules/regressions/evaluator.js";
import {
  BaselineRequiredError,
  resolveBaselineDeployment,
  resolveRecoveryBaseline,
  validateBaselineOrdering,
} from "./modules/regressions/baseline-resolver.js";
import { GitHubClient } from "./modules/github/client.js";
import {
  ensureChangeFromCommit,
  syncLatestWorkflowRuns,
  syncWorkflowRuns,
} from "./modules/github/sync.js";
import { SignozClient, type QueryWindow } from "./modules/signoz/client.js";
import { initTelemetry } from "./telemetry.js";

function buildEvaluationWindows(input: {
  config: AppConfig;
  observed: DeploymentRow;
  baselineChangeSha: string;
  observedChangeSha: string;
  route: string;
}) {
  const now = Date.now();
  const baselineWindowSeconds = input.config.GREENLIGHT_BASELINE_WINDOW_SECONDS * 1000;
  const observedWindowSeconds = input.config.GREENLIGHT_OBSERVED_WINDOW_SECONDS * 1000;
  const warmupSeconds = input.config.GREENLIGHT_WARMUP_SECONDS * 1000;

  const baselineWindow: QueryWindow = {
    serviceName: input.observed.service_name,
    serviceVersion: input.baselineChangeSha,
    environmentName: input.observed.environment_name,
    route: input.route,
    startMs: now - baselineWindowSeconds - observedWindowSeconds - warmupSeconds,
    endMs: now - observedWindowSeconds - warmupSeconds,
  };
  const observedWindow: QueryWindow = {
    ...baselineWindow,
    serviceVersion: input.observedChangeSha,
    startMs: now - observedWindowSeconds,
    endMs: now,
  };
  return { baselineWindow, observedWindow };
}

function changeShaForDeployment(repos: Repositories, deployment: DeploymentRow) {
  const change = repos.listChanges(200).find((row) => row.id === deployment.change_id);
  return change?.commit_sha ?? "";
}

export function buildServer(config: AppConfig) {
  const db = createDatabase(config.GREENLIGHT_DATABASE_PATH);
  const repos = new Repositories(db);
  const signoz = new SignozClient(config.SIGNOZ_URL, config.SIGNOZ_API_KEY);
  const github = new GitHubClient({
    token: config.GITHUB_TOKEN,
    repository: config.GITHUB_REPOSITORY,
  });
  const ensureChange = async (commitSha: string) => {
    await ensureChangeFromCommit({
      repos,
      github,
      repository: config.GITHUB_REPOSITORY,
      commitSha,
      defaultBranch: config.LMS_DEMO_BRANCH,
    });
  };
  const deployments = new DeploymentService(repos, undefined, undefined, ensureChange);

  const app = Fastify({ logger: false });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("Access-Control-Allow-Origin", "http://localhost:4173");
    reply.header("Access-Control-Allow-Headers", "Authorization, Content-Type");
    if (request.method === "OPTIONS") {
      reply.status(204).send();
    }
  });

  function requireAuth(request: { headers: { authorization?: string } }, reply: { status: (code: number) => { send: (payload: unknown) => void } }) {
    const header = request.headers.authorization;
    if (!header || header !== `Bearer ${config.GREENLIGHT_ADMIN_TOKEN}`) {
      reply.status(401).send({ error: "unauthorized" });
      return false;
    }
    return true;
  }

  app.get("/api/v1/health", async () => ({
    status: "ok",
    checks: {
      database: "ok",
      github: "ok",
      signoz: "ok",
      otlp: "ok",
    },
  }));

  app.get("/api/v1/changes", async () => {
    const changes = repos.listChanges(20);
    const pipelinesByChange = new Map(
      changes.map((change) => [change.id, repos.getPipelineRunsForChange(change.id)]),
    );
    const deploymentsByChange = new Map(
      changes.map((change) => [change.id, repos.getDeploymentsForChange(change.id)]),
    );
    const evaluationsByDeployment = new Map<string, ReturnType<Repositories["getLatestEvaluationForDeployment"]>>();
    for (const deploymentsForChange of deploymentsByChange.values()) {
      for (const deployment of deploymentsForChange) {
        const evaluation = repos.getLatestEvaluationForDeployment(deployment.id);
        if (evaluation) {
          evaluationsByDeployment.set(deployment.id, evaluation);
        }
      }
    }
    return {
      changes: listChangeSummaries(
        changes,
        pipelinesByChange,
        deploymentsByChange,
        evaluationsByDeployment as Map<string, NonNullable<ReturnType<Repositories["getLatestEvaluationForDeployment"]>>>,
      ),
    };
  });

  app.get<{ Params: { commitSha: string } }>("/api/v1/changes/:commitSha", async (request, reply) => {
    const receipt = getReceipt(repos, config.GITHUB_REPOSITORY, config.SIGNOZ_URL, request.params.commitSha);
    if (!receipt) {
      return reply.status(404).send({ error: "not_found" });
    }
    return receipt;
  });

  app.post("/api/v1/github/sync-runs", async (request, reply) => {
    if (!requireAuth(request, reply)) {
      return;
    }
    const body = request.body as {
      repository?: string;
      runIds: number[];
      primaryWorkflowName?: string;
    };
    try {
      const results = await syncWorkflowRuns({
        repos,
        github,
        repository: body.repository ?? config.GITHUB_REPOSITORY,
        runIds: body.runIds,
        primaryWorkflowName: body.primaryWorkflowName ?? config.GREENLIGHT_PRIMARY_WORKFLOW_NAME,
        defaultBranch: config.LMS_DEMO_BRANCH,
      });
      return { results };
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : "sync_failed",
      });
    }
  });

  app.post("/api/v1/github/sync-latest", async (request, reply) => {
    if (!requireAuth(request, reply)) {
      return;
    }
    const body = request.body as {
      repository?: string;
      branch?: string;
      primaryWorkflowName?: string;
    };
    try {
      const results = await syncLatestWorkflowRuns({
        repos,
        github,
        repository: body.repository ?? config.GITHUB_REPOSITORY,
        branch: body.branch ?? config.LMS_DEMO_BRANCH,
        primaryWorkflowName: body.primaryWorkflowName ?? config.GREENLIGHT_PRIMARY_WORKFLOW_NAME,
        defaultBranch: config.LMS_DEMO_BRANCH,
      });
      return { results };
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : "sync_failed",
      });
    }
  });

  app.post("/api/v1/deployments", async (request, reply) => {
    if (!requireAuth(request, reply)) {
      return;
    }
    try {
      const body = request.body as {
        repository: string;
        commitSha: string;
        serviceName: string;
        environmentName: string;
        role: "baseline" | "candidate" | "recovery";
        status: "started" | "succeeded" | "failed";
        deployedAt: string;
      };
      const result = await deployments.recordDeployment(body);
      return result;
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : "deployment_failed",
      });
    }
  });

  app.post("/api/v1/regressions/evaluate", async (request, reply) => {
    if (!requireAuth(request, reply)) {
      return;
    }
    const body = request.body as {
      deploymentId: string;
      baselineDeploymentId?: string;
      route: string;
      comparisonKind?: "deployment" | "recovery";
    };

    const allDeployments = repos.listDeployments();
    const observed = allDeployments.find((deployment) => deployment.id === body.deploymentId);
    if (!observed) {
      return reply.status(404).send({ error: "deployment_not_found" });
    }

    try {
      const comparisonKind = body.comparisonKind ?? "deployment";
      let baseline: DeploymentRow;
      if (comparisonKind === "recovery") {
        const regressedEvaluation = resolveRecoveryBaseline(
          repos.listRegressionEvaluations(),
          observed.service_name,
          observed.environment_name,
          body.route,
        );
        if (!regressedEvaluation) {
          throw new BaselineRequiredError("No regressed evaluation found for recovery comparison");
        }
        const resolved = allDeployments.find(
          (deployment) => deployment.id === regressedEvaluation.baseline_deployment_id,
        );
        if (!resolved) {
          throw new BaselineRequiredError("Original good baseline deployment is missing");
        }
        baseline = resolved;
      } else {
        baseline = resolveBaselineDeployment(
          allDeployments,
          observed.service_name,
          observed.environment_name,
          body.baselineDeploymentId,
        );
      }

      validateBaselineOrdering(baseline, observed);
      const baselineChangeSha = changeShaForDeployment(repos, baseline);
      const observedChangeSha = changeShaForDeployment(repos, observed);
      const { baselineWindow, observedWindow } = buildEvaluationWindows({
        config,
        observed,
        baselineChangeSha,
        observedChangeSha,
        route: body.route,
      });

      const [baselineMetrics, observedMetrics] = await Promise.all([
        signoz.queryWindow(baselineWindow),
        signoz.queryWindow(observedWindow),
      ]);

      const evaluation = evaluateRegression({
        comparisonKind,
        baseline: baselineMetrics,
        observed: observedMetrics,
        thresholds: {
          ...DEFAULT_THRESHOLDS,
          minSpans: config.GREENLIGHT_MIN_SPANS,
        },
      });

      const evaluationId = `eval_${observed.id}_${Date.now()}`;
      const dashboardUrl = signoz.buildDashboardUrl(observedWindow);
      repos.insertRegressionEvaluation({
        id: evaluationId,
        deployment_id: observed.id,
        baseline_deployment_id: baseline.id,
        route: body.route,
        comparison_kind: comparisonKind,
        baseline_service_version: baselineWindow.serviceVersion,
        observed_service_version: observedWindow.serviceVersion,
        baseline_start: new Date(baselineWindow.startMs).toISOString(),
        baseline_end: new Date(baselineWindow.endMs).toISOString(),
        observed_start: new Date(observedWindow.startMs).toISOString(),
        observed_end: new Date(observedWindow.endMs).toISOString(),
        baseline_request_count: evaluation.baselineRequestCount ?? 0,
        observed_request_count: evaluation.observedRequestCount ?? 0,
        baseline_p95_ms: evaluation.baselineP95Ms,
        observed_p95_ms: evaluation.observedP95Ms,
        latency_delta_pct: evaluation.latencyDeltaPct,
        baseline_error_rate: evaluation.baselineErrorRate,
        observed_error_rate: evaluation.observedErrorRate,
        status: evaluation.status,
        reasons_json: JSON.stringify(evaluation.reasons),
        signoz_dashboard_url: dashboardUrl,
        evaluated_at: new Date().toISOString(),
      });

      const slowTraceIds = await signoz.querySlowTraces(observedWindow, 3);
      const evidenceLinks = [
        {
          id: `${evaluationId}_dashboard`,
          regression_evaluation_id: evaluationId,
          kind: "signoz_dashboard" as const,
          label: "Deployment Impact dashboard",
          url: dashboardUrl,
          created_at: new Date().toISOString(),
        },
        ...slowTraceIds.map((traceId, index) => ({
          id: `${evaluationId}_trace_${index + 1}`,
          regression_evaluation_id: evaluationId,
          kind: "signoz_trace" as const,
          label: `Slow trace ${index + 1}`,
          url: signoz.buildTraceUrl(traceId),
          created_at: new Date().toISOString(),
        })),
      ];
      repos.insertEvidenceLinks(evidenceLinks);

      return {
        ...evaluation,
        evaluationId,
        evidenceLinks,
      };
    } catch (error) {
      if (error instanceof BaselineRequiredError) {
        return reply.status(409).send({ error: "baseline_required", message: error.message });
      }
      throw error;
    }
  });

  return app;
}

export async function startServer(config: AppConfig) {
  initTelemetry(config.OTEL_EXPORTER_OTLP_ENDPOINT, config.OTEL_SERVICE_NAME);
  const app = buildServer(config);
  await app.listen({ host: "127.0.0.1", port: config.GREENLIGHT_PORT });
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { loadConfig } = await import("./config.js");
  startServer(loadConfig());
}
