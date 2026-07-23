#!/usr/bin/env node
/**
 * OTLP HTTP/protobuf span smoke — GL-P1-T01
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

async function exportSpan({ startMs, name }) {
  const exporter = new OTLPTraceExporter({ url: `${OTLP_ENDPOINT}/v1/traces` });
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
  const headers = { "Content-Type": "application/json" };
  if (SIGNOZ_API_KEY) {
    headers["SIGNOZ-API-KEY"] = SIGNOZ_API_KEY;
  }

  const end = Date.now();
  const start = end - 24 * 60 * 60 * 1000;

  const body = {
    start: String(start),
    end: String(end),
    compositeQuery: {
      queryType: "builder",
      panelType: "list",
      builderQueries: {
        A: {
          dataSource: "traces",
          queryName: "A",
          aggregateOperator: "noop",
          filters: {
            items: [
              {
                key: { key: "traceID", type: "tag" },
                op: "=",
                value: traceIdHex,
              },
            ],
            op: "AND",
          },
          orderBy: [{ columnName: "timestamp", order: "desc" }],
          limit: 5,
          offset: 0,
        },
      },
    },
  };

  const response = await fetch(`${SIGNOZ_URL}/api/v5/query_range`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SigNoz query failed (${response.status}): ${text}`);
  }

  return response.json();
}

function countSpans(result) {
  return result?.data?.result?.[0]?.list?.length ?? 0;
}

async function queryTraceViaClickHouse(traceIdHex) {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);
  const container =
    process.env.SIGNOZ_CLICKHOUSE_CONTAINER ?? "signoz-telemetrystore-clickhouse-0-0";
  const { stdout } = await execFileAsync("docker", [
    "exec",
    container,
    "clickhouse-client",
    "--query",
    `SELECT count() FROM signoz_traces.distributed_signoz_index_v3 WHERE trace_id = '${traceIdHex}'`,
  ]);
  return Number(stdout.trim());
}

async function discoverTrace(traceIdHex) {
  if (SIGNOZ_API_KEY) {
    const result = await queryTraceViaApi(traceIdHex);
    return countSpans(result);
  }
  return queryTraceViaClickHouse(traceIdHex);
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
