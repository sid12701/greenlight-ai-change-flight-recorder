import Fastify from "fastify";
import type { AppConfig } from "./config.js";
import { createDatabase } from "./db/migrate.js";
import { Repositories } from "./db/repositories/index.js";
import { DeploymentService } from "./modules/deployments/service.js";
import { listChangeSummaries } from "./modules/changes/service.js";
import { getReceipt } from "./modules/receipts/assembler.js";
import { evaluateRegression } from "./modules/regressions/evaluator.js";
import {
  BaselineRequiredError,
  resolveBaselineDeployment,
  validateBaselineOrdering,
} from "./modules/regressions/baseline-resolver.js";
import { SignozClient } from "./modules/signoz/client.js";
import { initTelemetry } from "./telemetry.js";

export function buildServer(config: AppConfig) {
  const db = createDatabase(config.GREENLIGHT_DATABASE_PATH);
  const repos = new Repositories(db);
  const signoz = new SignozClient(config.SIGNOZ_URL, config.SIGNOZ_API_KEY);
  const deployments = new DeploymentService(repos);

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

    const allDeployments = repos.listChanges(100).flatMap((change) =>
      repos.getDeploymentsForChange(change.id),
    );
    const observed = allDeployments.find((deployment) => deployment.id === body.deploymentId);
    if (!observed) {
      return reply.status(404).send({ error: "deployment_not_found" });
    }

    try {
      const baseline = resolveBaselineDeployment(
        allDeployments,
        observed.service_name,
        observed.environment_name,
        body.baselineDeploymentId,
      );
      validateBaselineOrdering(baseline, observed);
      const baselineChange = repos.listChanges(100).find((change) =>
        repos.getDeploymentsForChange(change.id).some((deployment) => deployment.id === baseline.id),
      );
      const observedChange = repos.listChanges(100).find((change) =>
        repos.getDeploymentsForChange(change.id).some((deployment) => deployment.id === observed.id),
      );

      const now = Date.now();
      const baselineWindow = {
        serviceName: observed.service_name,
        serviceVersion: baselineChange?.commit_sha ?? "",
        environmentName: observed.environment_name,
        route: body.route,
        startMs: now - 180_000,
        endMs: now - 90_000,
      };
      const observedWindow = {
        ...baselineWindow,
        serviceVersion: observedChange?.commit_sha ?? "",
        startMs: now - 90_000,
        endMs: now,
      };

      const [baselineMetrics, observedMetrics] = await Promise.all([
        signoz.queryWindow(baselineWindow),
        signoz.queryWindow(observedWindow),
      ]);

      const evaluation = evaluateRegression({
        comparisonKind: body.comparisonKind ?? "deployment",
        baseline: baselineMetrics,
        observed: observedMetrics,
      });

      const evaluationId = `eval_${observed.id}`;
      repos.insertRegressionEvaluation({
        id: evaluationId,
        deployment_id: observed.id,
        baseline_deployment_id: baseline.id,
        route: body.route,
        comparison_kind: body.comparisonKind ?? "deployment",
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
        signoz_dashboard_url: signoz.buildDashboardUrl(observedWindow),
        evaluated_at: new Date().toISOString(),
      });

      return evaluation;
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
