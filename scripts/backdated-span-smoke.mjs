#!/usr/bin/env node
/**
 * OTLP HTTP/protobuf span smoke.
 */
import { BasicTracerProvider, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { trace, SpanStatusCode } from "@opentelemetry/api";
import {
  ATTR_SERVICE_NAME,
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
} from "@opentelemetry/semantic-conventions";

const OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318";
const SIGNOZ_URL = process.env.SIGNOZ_URL ?? "http://localhost:8080";
const SIGNOZ_API_KEY = process.env.SIGNOZ_API_KEY ?? "";
const SERVICE_NAME = process.env.SMOKE_SERVICE_NAME ?? "greenlight-smoke";
const BACKDATE_MS = Number(process.env.SMOKE_BACKDATE_MS ?? 2 * 60 * 60 * 1000);
const CURRENT_ONLY = process.argv.includes("--current-only");
const WAIT_MS = Number(process.env.SMOKE_WAIT_MS ?? 8000);
const EXPORT_TIMEOUT_MS = Number(process.env.SMOKE_EXPORT_TIMEOUT_MS ?? 10_000);

async function exportSpan({ startMs, name }) {
  const exporter = new OTLPTraceExporter({
    url: `${OTLP_ENDPOINT}/v1/traces`,
    timeoutMillis: EXPORT_TIMEOUT_MS,
  });
  const provider = new BasicTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: SERVICE_NAME,
      [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: "hackathon-demo",
    }),
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });

  trace.setGlobalTracerProvider(provider);
  const tracer = provider.getTracer("greenlight-smoke");
  const span = tracer.startSpan(name, { startTime: startMs });
  const traceIdHex = span.spanContext().traceId;
  span.setAttribute("smoke.test", "backdated-span-smoke");
  span.setAttribute("smoke.trace_id", traceIdHex);
  span.setStatus({ code: SpanStatusCode.OK });
  span.end(startMs + 500);

  await provider.forceFlush();
  await provider.shutdown();
  return traceIdHex;
}

async function queryTraceViaApi(traceIdHex) {
  const body = {
    schemaVersion: "v1",
    start: Date.now() - 3 * 60 * 60 * 1000,
    end: Date.now() + 60 * 1000,
    requestType: "scalar",
    compositeQuery: {
      queries: [{
        type: "builder_query",
        spec: {
          name: "A",
          signal: "traces",
          disabled: false,
          filter: { expression: `trace_id = '${traceIdHex}'` },
          aggregations: [{ expression: "count()" }],
        },
      }],
    },
  };

  const response = await fetch(new URL("/api/v5/query_range", SIGNOZ_URL), {
    method: "POST",
    headers: { "Content-Type": "application/json", "SIGNOZ-API-KEY": SIGNOZ_API_KEY },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`SigNoz query failed (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

/** Reads the scalar aggregation of the v5 response envelope. */
function countSpans(result) {
  const row = result?.data?.data?.results?.[0]?.data?.[0];
  const value = Number(row?.at?.(-1));
  return Number.isFinite(value) ? value : 0;
}

/**
 * Resolves the exported span through the supported SigNoz API only.
 *
 * There is deliberately no telemetry-store fallback: reading ClickHouse
 * directly would report success for a span the product itself could never
 * query, which is precisely the failure this smoke test exists to catch.
 */
async function discoverTrace(traceIdHex) {
  if (!SIGNOZ_API_KEY) {
    throw new Error(
      "SIGNOZ_API_KEY is required: the smoke test verifies the same query path the application uses",
    );
  }
  return countSpans(await queryTraceViaApi(traceIdHex));
}

async function main() {
  const now = Date.now();
  const startMs = CURRENT_ONLY ? now - 1000 : now - BACKDATE_MS;
  const name = CURRENT_ONLY ? "greenlight-smoke-current" : "greenlight-smoke-backdated";

  const traceIdHex = await exportSpan({ startMs, name });
  console.log(`Exported span traceId=${traceIdHex} start=${new Date(startMs).toISOString()}`);

  if (CURRENT_ONLY) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, WAIT_MS));

  const spans = await discoverTrace(traceIdHex);

  if (spans < 1) {
    throw new Error(
      `Backdated span not discoverable in SigNoz for traceId=${traceIdHex} (found ${spans})`,
    );
  }

  console.log(`Backdated span verified in SigNoz: traceId=${traceIdHex} spans=${spans}`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
