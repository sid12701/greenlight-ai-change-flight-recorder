#!/usr/bin/env node
/**
 * Build sanitized MCP investigation fixture from live SigNoz queries.
 */
import { execFile } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { SignozClient } from "../apps/api/src/modules/signoz/client.js";

const execFileAsync = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envText = readFileSync(join(root, ".env"), "utf8");
for (const line of envText.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq);
  const value = trimmed.slice(eq + 1).replace(/^['"]|['"]$/g, "");
  if (key && !(key in process.env)) process.env[key] = value;
}

const serviceName = process.env.MCP_SERVICE_NAME ?? "lms-backend";
const serviceVersion =
  process.env.MCP_SERVICE_VERSION ??
  process.env.BAD_SHA ??
  process.env.LMS_BASELINE_SHA ??
  "2269d064f0be50e7f6485c0be38e3cdcef6137d2";
const route = process.env.LMS_DEMO_ROUTE ?? "/api/v1/internal/home/overview";
const environmentName = "hackathon-demo";
const container =
  process.env.SIGNOZ_CLICKHOUSE_CONTAINER ?? "signoz-telemetrystore-clickhouse-0-0";

const signoz = new SignozClient(
  process.env.SIGNOZ_URL ?? "http://localhost:8080",
  process.env.SIGNOZ_API_KEY ?? "",
);

const now = Date.now();
const windowMs = Number(process.env.GREENLIGHT_OBSERVED_WINDOW_SECONDS ?? 90) * 1000;
const baselineWindow = {
  serviceName,
  serviceVersion: process.env.LMS_BASELINE_SHA ?? serviceVersion,
  environmentName,
  route,
  startMs: now - windowMs * 2,
  endMs: now - windowMs,
};
const observedWindow = {
  serviceName,
  serviceVersion,
  environmentName,
  route,
  startMs: now - windowMs,
  endMs: now,
};

async function queryClickHouse(sql) {
  const { stdout } = await execFileAsync("docker", [
    "exec",
    container,
    "clickhouse-client",
    "--query",
    sql,
  ]);
  return stdout.trim();
}

async function querySlowTraceIds() {
  const sql = `
    SELECT trace_id
    FROM (
      SELECT trace_id, max(duration_nano) AS max_duration
      FROM signoz_traces.distributed_signoz_index_v3
      WHERE resources_string['service.name'] = '${serviceName}'
        AND resources_string['service.version'] = '${serviceVersion}'
      GROUP BY trace_id
      ORDER BY max_duration DESC
      LIMIT 3
    )
  `;
  const output = await queryClickHouse(sql);
  return output.split("\n").map((line) => line.trim()).filter(Boolean);
}

async function queryP95(version, startMs, endMs) {
  const sql = `
    SELECT quantile(0.95)(duration_nano) / 1000000
    FROM signoz_traces.distributed_signoz_index_v3
    WHERE resources_string['service.name'] = '${serviceName}'
      AND resources_string['service.version'] = '${version}'
      AND attributes_string['http.route'] = '${route}'
      AND timestamp >= fromUnixTimestamp64Milli(${startMs})
      AND timestamp <= fromUnixTimestamp64Milli(${endMs})
  `;
  const output = await queryClickHouse(sql);
  const value = Number(output);
  return Number.isFinite(value) ? value : null;
}

const [baseline, observed, apiTraceIds] = await Promise.all([
  signoz.queryWindow(baselineWindow),
  signoz.queryWindow(observedWindow),
  signoz.querySlowTraces(observedWindow, 3),
]);

let traceIds = apiTraceIds;
if (traceIds.length < 3) {
  traceIds = await querySlowTraceIds();
}

const baselineP95Ms = baseline.p95Ms ?? (await queryP95(baselineWindow.serviceVersion, baselineWindow.startMs, baselineWindow.endMs));
const observedP95Ms = observed.p95Ms ?? (await queryP95(observedWindow.serviceVersion, observedWindow.startMs, observedWindow.endMs));

const fixture = {
  serviceName,
  serviceVersion,
  route,
  environmentName,
  baselineP95Ms,
  observedP95Ms,
  baselineErrorRate: baseline.errorRate,
  observedErrorRate: observed.errorRate,
  traceIds,
  correlationNote:
    "Temporal and version correlation only; no causation claim.",
};

if (fixture.traceIds.length !== 3) {
  throw new Error(`Expected 3 trace IDs, found ${fixture.traceIds.length}`);
}

const outDir = join(root, "test/fixtures/signoz");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "mcp-investigation.json");
writeFileSync(outPath, `${JSON.stringify(fixture, null, 2)}\n`);
console.log(`capture-mcp-fixture: wrote ${outPath}`);
console.log(JSON.stringify(fixture, null, 2));
