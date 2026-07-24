import type { SpanContext } from "@greenlight/shared";
import { type Link } from "@opentelemetry/api";

export function buildAiSpanLink(aiSpanContext: SpanContext | null | undefined): Link[] {
  if (!aiSpanContext) {
    return [];
  }

  return [
    {
      context: {
        traceId: aiSpanContext.traceId,
        spanId: aiSpanContext.spanId,
        traceFlags: Number.parseInt(aiSpanContext.flags, 16),
        isRemote: true,
      },
    },
  ];
}

export function shouldAttachAiLink(isPrimary: boolean, aiSpanContext: SpanContext | null | undefined) {
  return isPrimary && Boolean(aiSpanContext);
}

export function buildSignozTraceUrl(signozUrl: string, traceId: string, spanId?: string) {
  const url = new URL("/trace/" + traceId, signozUrl);
  if (spanId) {
    url.searchParams.set("spanId", spanId);
  }
  return url.toString();
}
