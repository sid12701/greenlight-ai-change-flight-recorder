#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), "../test/fixtures/signoz/mcp-investigation.json");

if (!existsSync(fixturePath)) {
  throw new Error("MCP fixture missing — run the official MCP capture first");
}

const payload = JSON.parse(readFileSync(fixturePath, "utf8"));
const text = JSON.stringify(payload).toLowerCase();

for (const key of [
  "transport",
  "serverUrl",
  "toolName",
  "serviceName",
  "baselineVersion",
  "candidateVersion",
  "route",
  "baselineP95Ms",
  "candidateP95Ms",
  "baselineErrorRate",
  "candidateErrorRate",
  "traceIds",
]) {
  if (!(key in payload)) {
    throw new Error(`Missing ${key} in MCP investigation fixture`);
  }
}

if (payload.transport !== "mcp-streamable-http") {
  throw new Error("MCP fixture must prove the official Streamable HTTP transport");
}
if (!/^[0-9a-f]{40}$/i.test(payload.candidateVersion)) {
  throw new Error("MCP fixture candidateVersion must be a full Git SHA");
}
if (process.env.BAD_SHA && payload.candidateVersion !== process.env.BAD_SHA) {
  throw new Error("MCP fixture candidateVersion does not match BAD_SHA");
}
for (const key of [
  "baselineP95Ms",
  "candidateP95Ms",
  "baselineErrorRate",
  "candidateErrorRate",
]) {
  if (typeof payload[key] !== "number" || !Number.isFinite(payload[key])) {
    throw new Error(`MCP fixture ${key} must be finite`);
  }
}
if (
  !Array.isArray(payload.traceIds) ||
  payload.traceIds.length !== 3 ||
  new Set(payload.traceIds).size !== 3 ||
  payload.traceIds.some((traceId) => !/^[0-9a-f]{32}$/i.test(traceId))
) {
  throw new Error("MCP fixture must include exactly three unique resolvable trace IDs");
}

if (text.includes("caused the") || text.includes("caused by the commit")) {
  throw new Error("MCP output must not claim causation");
}

/**
 * Resolving every trace is what makes them evidence.
 *
 * A well-formed 32-hex string is not proof that a trace exists, so this fails
 * rather than degrades when it cannot check. Reporting "validation passed"
 * after only pattern-matching would be the exact overstatement this project
 * exists to prevent, and it is worse here than anywhere else: the reader ran the
 * command precisely to avoid taking the numbers on trust.
 *
 * `--offline` exists for callers that genuinely only want the shape checked —
 * a unit test, or a contributor with no stack running — and says so out loud.
 */
const offline = process.argv.includes("--offline");
if (offline) {
  console.warn(
    "verify-mcp-result: --offline — the fixture's shape was checked and no trace was resolved",
  );
  console.log("verify-mcp-result: offline fixture checks passed (traces NOT verified)");
  process.exit(0);
}

if (!process.env.SIGNOZ_API_KEY) {
  console.error(
    "verify-mcp-result: SIGNOZ_API_KEY is not set, so no trace could be resolved.\n" +
    "  This gate exists to prove the recorded trace IDs exist in a live SigNoz.\n" +
    "  Run it against the demo stack:\n" +
    "    set -a && . ./.env.demo && set +a && npm run mcp:verify\n" +
    "  Or check the fixture's shape only, without verifying anything:\n" +
    "    node scripts/verify-mcp-result.mjs --offline",
  );
  process.exit(1);
}

{
  const signozUrl = process.env.SIGNOZ_URL ?? "http://localhost:8080";
  const windowStart = Date.parse(payload.window?.start ?? "") || Date.now() - 24 * 60 * 60 * 1000;
  const windowEnd = Date.parse(payload.window?.end ?? "") || Date.now();

  for (const traceId of payload.traceIds) {
    const response = await fetch(new URL("/api/v5/query_range", signozUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "SIGNOZ-API-KEY": process.env.SIGNOZ_API_KEY,
      },
      body: JSON.stringify({
        schemaVersion: "v1",
        start: windowStart - 60_000,
        end: windowEnd + 60_000,
        requestType: "scalar",
        compositeQuery: {
          queries: [{
            type: "builder_query",
            spec: {
              name: "A",
              signal: "traces",
              disabled: false,
              filter: { expression: `trace_id = '${traceId}'` },
              aggregations: [{ expression: "count()" }],
            },
          }],
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error(`Could not resolve trace ${traceId}: SigNoz returned HTTP ${response.status}`);
    }
    const body = await response.json();
    const spans = Number(body?.data?.data?.results?.[0]?.data?.[0]?.at(-1) ?? 0);
    if (!Number.isFinite(spans) || spans < 1) {
      throw new Error(`MCP reported trace ${traceId}, but it does not resolve in SigNoz`);
    }
    console.log(`verify-mcp-result: trace ${traceId} resolves (${spans} spans)`);
  }
}

console.log(
  `verify-mcp-result: all ${payload.traceIds.length} MCP-reported traces resolve in SigNoz`,
);
