export type TraceparentErrorCode =
  | "missing"
  | "unsupported_version"
  | "invalid_format"
  | "invalid_trace_id"
  | "invalid_span_id"
  | "zero_trace_id"
  | "zero_span_id"
  | "invalid_flags"
  | "missing_trailer"
  | "duplicate_trailer"
  | "invalid_trailer";

export interface SpanContext {
  version: "00";
  traceId: string;
  spanId: string;
  flags: string;
}

export interface TraceparentError {
  ok: false;
  code: TraceparentErrorCode;
  message: string;
}

export interface TraceparentSuccess {
  ok: true;
  value: SpanContext;
}

export type ParseTraceparentResult = TraceparentSuccess | TraceparentError;

const TRACEPARENT_RE =
  /^00-([0-9a-fA-F]{32})-([0-9a-fA-F]{16})-([0-9a-fA-F]{2})$/;
const TRAILER_RE = /^AI-Traceparent:\s*(.+)$/im;
const ZERO_TRACE_ID = "00000000000000000000000000000000";
const ZERO_SPAN_ID = "0000000000000000";

function error(
  code: TraceparentErrorCode,
  message: string,
): TraceparentError {
  return { ok: false, code, message };
}

export function parseTraceparent(input: string): ParseTraceparentResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return error("missing", "Traceparent value is required");
  }
  if (/\s/.test(trimmed)) {
    return error("invalid_format", "Traceparent must not contain whitespace");
  }

  const match = TRACEPARENT_RE.exec(trimmed);
  if (!match) {
    if (trimmed.startsWith("00-")) {
      const parts = trimmed.split("-");
      if (parts.length !== 4) {
        return error("invalid_format", "Traceparent must have four fields");
      }
      const [, traceId, spanId, flags] = parts;
      if (!/^[0-9a-fA-F]{32}$/.test(traceId)) {
        return error("invalid_trace_id", "Trace ID must be 32 hex characters");
      }
      if (!/^[0-9a-fA-F]{16}$/.test(spanId)) {
        return error("invalid_span_id", "Span ID must be 16 hex characters");
      }
      if (!/^[0-9a-fA-F]{2}$/.test(flags)) {
        return error("invalid_flags", "Flags must be 2 hex characters");
      }
    }
    if (/^0[1-9a-fA-F]-/.test(trimmed)) {
      return error("unsupported_version", "Only W3C traceparent version 00 is supported");
    }
    return error("invalid_format", "Traceparent format is invalid");
  }

  const [, traceIdRaw, spanIdRaw, flagsRaw] = match;
  const traceId = traceIdRaw.toLowerCase();
  const spanId = spanIdRaw.toLowerCase();
  const flags = flagsRaw.toLowerCase();

  if (traceId === ZERO_TRACE_ID) {
    return error("zero_trace_id", "Trace ID must not be all zeros");
  }
  if (spanId === ZERO_SPAN_ID) {
    return error("zero_span_id", "Span ID must not be all zeros");
  }

  return {
    ok: true,
    value: {
      version: "00",
      traceId,
      spanId,
      flags,
    },
  };
}

export function formatTraceparent(context: SpanContext): string {
  return `${context.version}-${context.traceId}-${context.spanId}-${context.flags}`;
}

export function extractAiTraceparentFromMessage(
  message: string,
): ParseTraceparentResult {
  const matches = [...message.matchAll(/^AI-Traceparent:\s*(.+)$/gim)];
  if (matches.length === 0) {
    return error("missing_trailer", "AI-Traceparent trailer is missing");
  }
  if (matches.length > 1) {
    return error("duplicate_trailer", "Multiple AI-Traceparent trailers found");
  }

  const parsed = parseTraceparent(matches[0][1]);
  if (!parsed.ok) {
    return error("invalid_trailer", "AI-Traceparent trailer is invalid");
  }
  return parsed;
}

export function toRemoteSpanContext(context: SpanContext): {
  traceId: string;
  spanId: string;
  traceFlags: number;
  isRemote: true;
} {
  return {
    traceId: context.traceId,
    spanId: context.spanId,
    traceFlags: Number.parseInt(context.flags, 16),
    isRemote: true,
  };
}
