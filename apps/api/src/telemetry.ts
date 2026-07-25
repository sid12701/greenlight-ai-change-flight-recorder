/**
 * Process telemetry bootstrap.
 *
 * This module must be imported and `initTelemetry` called before Fastify or
 * any instrumented library is loaded, otherwise the instrumentation patches
 * arrive too late to wrap them.
 *
 * All three signals are exported so SigNoz is a complete system of record for
 * GreenLight itself, not only for the workload it observes.
 */
import { logs } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { BatchSpanProcessor, type SpanExporter } from "@opentelemetry/sdk-trace-base";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";

export interface TelemetryOptions {
  endpoint: string;
  serviceName: string;
  serviceVersion: string;
  environmentName: string;
}

/**
 * Header and attribute names whose values must never leave the process.
 *
 * Log redaction alone is not enough: spans carry request headers and exception
 * events, and those travel to SigNoz on a different path than the logger.
 */
const SENSITIVE_ATTRIBUTE = /authorization|api[-_]?key|token|password|secret|cookie|set-cookie/i;
const REDACTED = "[redacted]";

let sdk: NodeSDK | undefined;
let loggerProvider: LoggerProvider | undefined;

export function buildResource(options: TelemetryOptions) {
  return resourceFromAttributes({
    [ATTR_SERVICE_NAME]: options.serviceName,
    [ATTR_SERVICE_VERSION]: options.serviceVersion,
    // SigNoz filters on `deployment.environment.name`; GreenLight's own
    // telemetry must be filterable the same way as the workload's.
    "deployment.environment.name": options.environmentName,
  });
}

/**
 * Removes credential-bearing values from a span before export.
 *
 * Applied as a span processor so it covers attributes contributed by
 * auto-instrumentation, which the application never sees directly.
 */
export function redactSpanAttributes(
  attributes: Record<string, unknown>,
): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attributes)) {
    redacted[key] = SENSITIVE_ATTRIBUTE.test(key) ? REDACTED : value;
  }
  return redacted;
}

/**
 * Strips absolute filesystem paths from a stack trace so that exported
 * exceptions do not disclose the host's directory layout or user name.
 */
export function sanitizeStackTrace(stack: string, projectRoot: string): string {
  return stack
    .replaceAll(`file://${projectRoot}`, "")
    .replaceAll(projectRoot, "")
    .replace(/\/(?:Users|home|root)\/[^\s):]+/g, "<path>");
}

class RedactingSpanProcessor extends BatchSpanProcessor {
  constructor(exporter: SpanExporter, private readonly projectRoot: string) {
    super(exporter);
  }

  override onEnd(span: Parameters<BatchSpanProcessor["onEnd"]>[0]): void {
    const mutable = span as unknown as {
      attributes: Record<string, unknown>;
      events: Array<{ attributes?: Record<string, unknown> }>;
    };
    mutable.attributes = redactSpanAttributes(mutable.attributes);
    for (const event of mutable.events ?? []) {
      if (!event.attributes) {
        continue;
      }
      const attributes = redactSpanAttributes(event.attributes);
      const stack = attributes["exception.stacktrace"];
      if (typeof stack === "string") {
        attributes["exception.stacktrace"] = sanitizeStackTrace(stack, this.projectRoot);
      }
      event.attributes = attributes;
    }
    super.onEnd(span);
  }
}

export function initTelemetry(options: TelemetryOptions): NodeSDK {
  if (sdk) {
    return sdk;
  }

  // The OpenTelemetry SDK also reads service identity from the environment,
  // and those values win over a programmatic resource. A shared `.env` that
  // sets OTEL_SERVICE_NAME would therefore label every co-located process
  // with one name — which is how the worker's spans previously arrived
  // labelled as the API. The caller's intent is authoritative, so it is
  // written back to the environment before the SDK reads it.
  process.env.OTEL_SERVICE_NAME = options.serviceName;
  process.env.OTEL_RESOURCE_ATTRIBUTES = [
    `service.name=${options.serviceName}`,
    `service.version=${options.serviceVersion}`,
    `deployment.environment.name=${options.environmentName}`,
  ].join(",");

  const resource = buildResource(options);
  const projectRoot = process.cwd();

  loggerProvider = new LoggerProvider({
    resource,
    processors: [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({ url: `${options.endpoint}/v1/logs` }),
      }),
    ],
  });
  logs.setGlobalLoggerProvider(loggerProvider);

  sdk = new NodeSDK({
    resource,
    spanProcessors: [
      new RedactingSpanProcessor(
        new OTLPTraceExporter({ url: `${options.endpoint}/v1/traces` }),
        projectRoot,
      ),
    ],
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: `${options.endpoint}/v1/metrics` }),
      exportIntervalMillis: 15_000,
    }),
    instrumentations: [
      new HttpInstrumentation({
        // Health and readiness probes would otherwise dominate the trace
        // volume without adding diagnostic value.
        ignoreIncomingRequestHook: (request) =>
          ["/livez", "/readyz"].includes((request.url ?? "").split("?")[0]),
        headersToSpanAttributes: {
          server: { requestHeaders: [], responseHeaders: [] },
          client: { requestHeaders: [], responseHeaders: [] },
        },
      }),
      // Fastify itself is instrumented by the `@fastify/otel` plugin that
      // `buildServer` registers. The monkey-patching instrumentation cannot
      // reach an ESM `import` of Fastify without a loader hook, so it silently
      // produced spans named `GET` with no `http.route` to group or filter on.
    ],
  });
  sdk.start();
  return sdk;
}

export async function shutdownTelemetry(): Promise<void> {
  await loggerProvider?.shutdown();
  loggerProvider = undefined;
  await sdk?.shutdown();
  sdk = undefined;
}
