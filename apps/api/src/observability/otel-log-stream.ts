/**
 * Forwards Fastify's own log records to SigNoz.
 *
 * The worker logs through `createLogger`, which emits on the OpenTelemetry
 * logs API, but the HTTP server logs through Fastify's pino instance. Without
 * this bridge those records only ever reached stdout, so the request side of
 * the system — the half a reader is most likely to be investigating — was
 * absent from SigNoz entirely.
 *
 * Records keep flowing to stdout as well, because the container runtime is
 * still the fallback when the collector is the thing that is broken.
 */
import { logs, SeverityNumber } from "@opentelemetry/api-logs";

/** pino numeric levels, ascending. */
const SEVERITY: Array<{ level: number; number: SeverityNumber; text: string }> = [
  { level: 10, number: SeverityNumber.TRACE, text: "TRACE" },
  { level: 20, number: SeverityNumber.DEBUG, text: "DEBUG" },
  { level: 30, number: SeverityNumber.INFO, text: "INFO" },
  { level: 40, number: SeverityNumber.WARN, text: "WARN" },
  { level: 50, number: SeverityNumber.ERROR, text: "ERROR" },
  { level: 60, number: SeverityNumber.FATAL, text: "FATAL" },
];

function severityFor(level: unknown) {
  const numeric = typeof level === "number" ? level : 30;
  // pino permits custom levels between the standard ones, so the closest
  // standard severity at or below the value is used rather than an exact match.
  let resolved = SEVERITY[2];
  for (const candidate of SEVERITY) {
    if (numeric >= candidate.level) {
      resolved = candidate;
    }
  }
  return resolved;
}

/** Fields that describe the record itself rather than the event. */
const ENVELOPE = new Set(["level", "time", "msg", "pid", "hostname", "v"]);

function flatten(value: unknown, prefix: string, into: Record<string, unknown>, depth = 0) {
  if (value === null || value === undefined) {
    return;
  }
  if (depth < 3 && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      flatten(entry, prefix ? `${prefix}.${key}` : key, into, depth + 1);
    }
    return;
  }
  into[prefix] = Array.isArray(value) ? JSON.stringify(value) : value;
}

export interface OtelLogStreamOptions {
  service: string;
  /** Injectable for tests; defaults to stdout. */
  write?: (line: string) => void;
  /** Injectable for tests; defaults to the global OTel logger provider. */
  emit?: (record: {
    severityNumber: SeverityNumber;
    severityText: string;
    body: string;
    attributes: Record<string, unknown>;
  }) => void;
}

/**
 * Returns a pino destination.
 *
 * Trace context is not attached here. The OpenTelemetry logs SDK reads the
 * active context when the record is emitted, and pino writes synchronously
 * inside the call that logged, so the request's span is still current.
 */
export function createOtelLogStream(options: OtelLogStreamOptions) {
  const write = options.write ?? ((line: string) => process.stdout.write(line));
  const otelLogger = logs.getLogger(options.service);
  const emit = options.emit ?? ((record) => otelLogger.emit(record as never));

  return {
    write(line: string) {
      write(line);

      let record: Record<string, unknown>;
      try {
        record = JSON.parse(line) as Record<string, unknown>;
      } catch {
        // A record that is not JSON has already reached stdout. Dropping it
        // here is better than throwing inside the logger and losing the
        // request that produced it.
        return;
      }

      const severity = severityFor(record.level);
      const attributes: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(record)) {
        if (!ENVELOPE.has(key)) {
          flatten(value, key, attributes);
        }
      }

      emit({
        severityNumber: severity.number,
        severityText: severity.text,
        body: typeof record.msg === "string" ? record.msg : "",
        attributes,
      });
    },
  };
}
