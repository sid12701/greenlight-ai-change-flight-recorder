/**
 * Structured logging for every GreenLight process.
 *
 * Records are written as JSON to stdout (for the container runtime) and
 * emitted through the OpenTelemetry logs API (for SigNoz), so a background
 * worker is as debuggable as an HTTP handler. Trace context is attached
 * automatically, which is what makes a log line joinable to its span.
 */
import { logs, SeverityNumber, type LogAttributes } from "@opentelemetry/api-logs";
import { trace } from "@opentelemetry/api";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

const LEVEL_ORDER: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

const SEVERITY: Record<LogLevel, SeverityNumber> = {
  trace: SeverityNumber.TRACE,
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
  fatal: SeverityNumber.FATAL,
};

const SENSITIVE_KEY = /authorization|api[-_]?key|token|password|secret|cookie/i;
const REDACTED = "[redacted]";
const MAX_DEPTH = 6;

export type LogFields = Record<string, unknown>;

/** Recursively removes credential-bearing values and normalises errors. */
export function redactFields(value: unknown, depth = 0): unknown {
  if (depth >= MAX_DEPTH) {
    return "[truncated]";
  }
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactFields(entry, depth + 1));
  }
  if (value && typeof value === "object") {
    const output: LogFields = {};
    for (const [key, entry] of Object.entries(value as LogFields)) {
      output[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactFields(entry, depth + 1);
    }
    return output;
  }
  return value;
}

export interface Logger {
  child(bindings: LogFields): Logger;
  log(level: LogLevel, message: string, fields?: LogFields): void;
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

export interface LoggerOptions {
  level: LogLevel;
  service: string;
  bindings?: LogFields;
  /** Injectable for tests; defaults to stdout. */
  write?: (line: string) => void;
  /** Injectable for tests; defaults to the global OTel logger provider. */
  emit?: (record: { level: LogLevel; message: string; fields: LogFields }) => void;
}

function defaultWrite(line: string) {
  process.stdout.write(`${line}\n`);
}

export function createLogger(options: LoggerOptions): Logger {
  const write = options.write ?? defaultWrite;
  const threshold = LEVEL_ORDER[options.level];
  const otelLogger = logs.getLogger(options.service);

  const emit = options.emit ?? ((record) => {
    otelLogger.emit({
      severityNumber: SEVERITY[record.level],
      severityText: record.level.toUpperCase(),
      body: record.message,
      // Already redacted and depth-bounded by `redactFields`, which is what
      // makes these values safe to hand to an exporter.
      attributes: record.fields as LogAttributes,
    });
  });

  const build = (bindings: LogFields): Logger => ({
    child(extra) {
      return build({ ...bindings, ...extra });
    },
    log(level, message, fields) {
      if (LEVEL_ORDER[level] < threshold) {
        return;
      }
      const merged = redactFields({ ...bindings, ...fields }) as LogFields;
      const spanContext = trace.getActiveSpan()?.spanContext();
      write(JSON.stringify({
        time: new Date().toISOString(),
        level,
        service: options.service,
        message,
        ...(spanContext
          ? { trace_id: spanContext.traceId, span_id: spanContext.spanId }
          : {}),
        ...merged,
      }));
      emit({ level, message, fields: merged });
    },
    debug(message, fields) {
      this.log("debug", message, fields);
    },
    info(message, fields) {
      this.log("info", message, fields);
    },
    warn(message, fields) {
      this.log("warn", message, fields);
    },
    error(message, fields) {
      this.log("error", message, fields);
    },
  });

  return build(options.bindings ?? {});
}
