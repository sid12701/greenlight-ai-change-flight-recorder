/**
 * Worker process entrypoint.
 *
 * Telemetry is initialised before the runtime module is imported so that
 * OpenTelemetry can patch the HTTP client the integrations use. The runtime
 * itself lives in `worker-runtime.ts` and has no import-time side effects.
 */
import { loadConfig, signozPublicUrl } from "./config.js";
import { createRepositories } from "./db/store.js";
import { GitHubClient } from "./modules/github/client.js";
import { SignozClient } from "./modules/signoz/client.js";
import { createLogger } from "./observability/logger.js";
import { initTelemetry, shutdownTelemetry } from "./telemetry.js";

const WORKER_SERVICE_NAME = "greenlight-worker";

async function main() {
  const config = loadConfig();
  initTelemetry({
    endpoint: config.OTEL_EXPORTER_OTLP_ENDPOINT,
    serviceName: WORKER_SERVICE_NAME,
    serviceVersion: config.GREENLIGHT_SERVICE_VERSION,
    environmentName: config.GREENLIGHT_ENV,
  });

  const { buildJobProcessor, runWorker } = await import("./worker-runtime.js");

  const logger = createLogger({
    level: config.GREENLIGHT_LOG_LEVEL,
    service: WORKER_SERVICE_NAME,
  });
  const repos = await createRepositories({
    databasePath: config.GREENLIGHT_DATABASE_PATH,
    connectionUrl: config.GREENLIGHT_DATABASE_URL,
  });
  const signoz = new SignozClient(config.SIGNOZ_URL, config.SIGNOZ_API_KEY, {
    maxAttempts: config.SIGNOZ_QUERY_MAX_ATTEMPTS,
    requestTimeoutMs: config.SIGNOZ_QUERY_TIMEOUT_MS,
    deploymentDashboardId: config.SIGNOZ_DEPLOYMENT_DASHBOARD_ID,
    publicBaseUrl: signozPublicUrl(config),
  });
  const github = new GitHubClient({
    token: config.GITHUB_TOKEN,
    repository: config.GITHUB_REPOSITORY,
  });

  const controller = new AbortController();
  const stop = (signal: string) => {
    if (controller.signal.aborted) {
      return;
    }
    logger.info("worker shutdown requested", { signal });
    controller.abort();
  };
  process.once("SIGTERM", () => stop("SIGTERM"));
  process.once("SIGINT", () => stop("SIGINT"));

  // Report the store actually in use, not the file path that a networked
  // deployment never touches.
  logger.info("worker started", {
    store: config.GREENLIGHT_DATABASE_URL
      ? `postgres:${new URL(config.GREENLIGHT_DATABASE_URL).pathname.replace("/", "")}`
      : `sqlite:${config.GREENLIGHT_DATABASE_PATH}`,
  });
  try {
    await runWorker({
      repos,
      config,
      logger,
      processJob: buildJobProcessor({ repos, config, signoz, github }),
      signal: controller.signal,
    });
  } finally {
    logger.info("worker stopped");
    await shutdownTelemetry();
    repos.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(JSON.stringify({
      level: "fatal",
      service: WORKER_SERVICE_NAME,
      message: error instanceof Error ? error.message : String(error),
    }));
    process.exitCode = 1;
  });
}
