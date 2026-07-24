/**
 * Deployment marker spans.
 *
 * The markers are emitted under the *workload's* resource identity — service
 * name, version and environment of the thing being deployed — because that is
 * the identity every deployment-impact query and dashboard filters on. Emitting
 * them under the worker's own identity would leave markers that nothing in the
 * system can correlate with the telemetry they mark.
 */
import { context, trace } from "@opentelemetry/api";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  BasicTracerProvider,
  BatchSpanProcessor,
  type SpanExporter,
} from "@opentelemetry/sdk-trace-base";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { toHrTime } from "../github/normalize.js";

export interface DeploymentTelemetryInput {
  deploymentId: string;
  commitSha: string;
  serviceName: string;
  environmentName: string;
  route: string;
  imageDigest: string;
  status: "started" | "succeeded" | "failed";
  deployedAt: string;
}

export interface DeploymentTelemetryResult {
  traceId: string;
  spanCount: number;
}

export async function emitDeploymentTrace(
  input: DeploymentTelemetryInput,
  exporter: SpanExporter,
): Promise<DeploymentTelemetryResult> {
  const provider = new BasicTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: input.serviceName,
      [ATTR_SERVICE_VERSION]: input.commitSha,
      "deployment.environment.name": input.environmentName,
      "greenlight.telemetry.origin": "deployment_marker",
    }),
    spanProcessors: [new BatchSpanProcessor(exporter)],
  });

  try {
    const tracer = provider.getTracer("greenlight-deployments");
    const attributes = {
      "deployment.id": input.deploymentId,
      "deployment.status": input.status,
      "http.route": input.route,
      "container.image.digest": input.imageDigest,
      "vcs.ref.head.revision": input.commitSha,
    };

    const root = tracer.startSpan("deployment.started", {
      startTime: toHrTime(Date.parse(input.deployedAt)),
      attributes,
    });
    let spanCount = 1;

    if (input.status !== "started") {
      const terminal = tracer.startSpan(
        `deployment.${input.status}`,
        { attributes },
        trace.setSpan(context.active(), root),
      );
      if (input.status === "failed") {
        terminal.setStatus({ code: 2, message: "deployment failed" });
        root.setStatus({ code: 2, message: "deployment failed" });
      }
      terminal.end();
      spanCount += 1;
    }
    root.end();

    await provider.forceFlush();
    return { traceId: root.spanContext().traceId, spanCount };
  } finally {
    await provider.shutdown();
  }
}
