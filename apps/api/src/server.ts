/**
 * API process entrypoint.
 *
 * Telemetry is initialised before the application module is imported, because
 * OpenTelemetry instrumentation patches libraries at load time — registering
 * it after Fastify is already in the module graph silently produces an
 * uninstrumented process.
 *
 * The application itself lives in `app.ts` and is importable without side
 * effects, so tests can build a server without starting telemetry.
 */
import { loadConfig, type AppConfig } from "./config.js";
import { initTelemetry, shutdownTelemetry } from "./telemetry.js";

const API_SERVICE_NAME = "greenlight-api";

export async function startServer(config: AppConfig) {
  initTelemetry({
    endpoint: config.OTEL_EXPORTER_OTLP_ENDPOINT,
    serviceName: config.OTEL_SERVICE_NAME || API_SERVICE_NAME,
    serviceVersion: config.GREENLIGHT_SERVICE_VERSION,
    environmentName: config.GREENLIGHT_ENV,
  });
  const { buildServer } = await import("./app.js");
  const app = await buildServer(config);
  await app.listen({ host: config.GREENLIGHT_HOST, port: config.GREENLIGHT_PORT });
  return app;
}

async function main() {
  const app = await startServer(loadConfig());

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) {
      return;
    }
    stopping = true;
    app.log.info({ signal }, "graceful shutdown started");
    try {
      await app.close();
      await shutdownTelemetry();
      process.exitCode = 0;
    } catch (error) {
      app.log.error({ err: error }, "graceful shutdown failed");
      process.exitCode = 1;
    }
  };
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
