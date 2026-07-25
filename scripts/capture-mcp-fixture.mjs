#!/usr/bin/env node
/**
 * Captures a SigNoz investigation through the official MCP client transport.
 *
 * This is the agent-native path: rather than GreenLight calling the SigNoz
 * query API itself, it asks the SigNoz MCP server the same questions an
 * investigating agent would, and records what came back.
 *
 * There is deliberately no direct-API or telemetry-store fallback. If MCP
 * cannot answer, the capture fails and no fixture is written — a fixture that
 * did not come from MCP would misrepresent the evidence it claims to be.
 *
 * Required environment:
 *   SIGNOZ_MCP_URL     streamable-HTTP endpoint of the SigNoz MCP server
 *   SIGNOZ_API_KEY     service-account key the server authenticates with
 *   CANDIDATE_SHA      candidate service.version under investigation
 *   BASELINE_SHA       baseline service.version to compare against
 * Optional:
 *   MCP_SERVICE_NAME       (default blnk-loan-workload)
 *   MCP_ENVIRONMENT_NAME   (default hackathon-demo)
 *   MCP_ROUTE              (default /balances)
 *   MCP_WINDOW_MINUTES     (default 120)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let Client;
let StreamableHTTPClientTransport;
try {
  ({ Client } = await import("@modelcontextprotocol/sdk/client/index.js"));
  ({ StreamableHTTPClientTransport } = await import(
    "@modelcontextprotocol/sdk/client/streamableHttp.js"
  ));
} catch {
  throw new Error(
    "The official @modelcontextprotocol/sdk dependency is required; install dependencies before capturing MCP evidence",
  );
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

const mcpUrl = required("SIGNOZ_MCP_URL");
const apiKey = required("SIGNOZ_API_KEY");
const candidateVersion = required("CANDIDATE_SHA");
const baselineVersion = required("BASELINE_SHA");
const serviceName = process.env.MCP_SERVICE_NAME ?? "blnk-loan-workload";
const environmentName = process.env.MCP_ENVIRONMENT_NAME ?? "hackathon-demo";
const route = process.env.MCP_ROUTE ?? "/balances";
const windowMinutes = Number(process.env.MCP_WINDOW_MINUTES ?? 120);

const end = Date.now();
const start = end - windowMinutes * 60_000;

/** Scopes every question to one immutable deployed version on one route. */
function scope(version) {
  return `service.name = '${serviceName}' AND service.version = '${version}' ` +
    `AND deployment.environment.name = '${environmentName}' AND http.route = '${route}'`;
}

/**
 * Reads the JSON payload out of an MCP tool result.
 *
 * SigNoz returns several text items per call: the JSON answer plus
 * human-readable guidance such as pagination hints. Concatenating them
 * produces invalid JSON, so each item is tried in turn and the first that
 * parses is the answer.
 */
function parseJson(result, tool) {
  const texts = (result.content ?? [])
    .filter((item) => item.type === "text" && typeof item.text === "string")
    .map((item) => item.text);
  if (texts.length === 0) {
    throw new Error(`${tool} returned no text content`);
  }
  for (const text of texts) {
    try {
      return JSON.parse(text);
    } catch {
      // Not the JSON item; keep looking.
    }
  }
  throw new Error(`${tool} returned no JSON payload: ${texts[0].slice(0, 200)}`);
}

/** Reads the single scalar value out of an ungrouped aggregate response. */
function scalarFrom(payload) {
  const rows = payload?.data?.data?.results?.[0]?.data
    ?? payload?.data?.results?.[0]?.data
    ?? payload?.results?.[0]?.data
    ?? payload?.data;
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }
  const first = Array.isArray(rows[0]) ? rows[0].at(-1) : rows[0];
  if (first === null || first === undefined) {
    return null;
  }
  const value = Number(typeof first === "object" ? Object.values(first).at(-1) : first);
  return Number.isFinite(value) ? value : null;
}

/** Collects distinct trace IDs out of a raw span search response. */
function traceIdsFrom(payload) {
  const found = [];
  const visit = (node) => {
    if (found.length >= 3 || node === null || typeof node !== "object") {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (
        (key === "trace_id" || key === "traceId" || key === "traceID") &&
        typeof value === "string" && /^[0-9a-f]{32}$/i.test(value) &&
        !found.includes(value)
      ) {
        found.push(value);
      } else {
        visit(value);
      }
    }
  };
  visit(payload);
  return found;
}

const client = new Client(
  { name: "greenlight-mcp-evidence", version: "1.0.0" },
  { capabilities: {} },
);
const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
  requestInit: { headers: { "SIGNOZ-API-KEY": apiKey } },
});
await client.connect(transport);

try {
  const { tools } = await client.listTools();
  const advertised = new Set(tools.map((tool) => tool.name));
  for (const tool of ["signoz_aggregate_traces", "signoz_search_traces"]) {
    if (!advertised.has(tool)) {
      throw new Error(`SigNoz MCP server does not advertise the required tool "${tool}"`);
    }
  }

  const aggregate = async (version, aggregation, extra = {}) => {
    const result = await client.callTool({
      name: "signoz_aggregate_traces",
      arguments: {
        filter: scope(version),
        aggregation,
        start,
        end,
        requestType: "scalar",
        ...(aggregation === "count" ? {} : { aggregateOn: "duration_nano" }),
        ...extra,
      },
    });
    return scalarFrom(parseJson(result, "signoz_aggregate_traces"));
  };

  const errorRate = async (version) => {
    const total = await aggregate(version, "count");
    if (total === null || total === 0) {
      return null;
    }
    const failed = await aggregate(version, "count", { error: true });
    return failed === null ? null : (failed / total) * 100;
  };

  const [baselineP95Nanos, candidateP95Nanos] = await Promise.all([
    aggregate(baselineVersion, "p95"),
    aggregate(candidateVersion, "p95"),
  ]);
  const baselineErrorRate = await errorRate(baselineVersion);
  const candidateErrorRate = await errorRate(candidateVersion);

  const slowest = await client.callTool({
    name: "signoz_search_traces",
    arguments: {
      filter: scope(candidateVersion),
      start,
      end,
      limit: 20,
      orderBy: "duration_nano:desc",
    },
  });
  const traceIds = traceIdsFrom(parseJson(slowest, "signoz_search_traces"));

  const toMilliseconds = (nanos) => (nanos === null ? null : nanos / 1_000_000);

  const investigation = {
    // Records how the evidence was obtained, so a reader can tell an MCP
    // answer from a direct API call.
    transport: "mcp-streamable-http",
    serverUrl: new URL(mcpUrl).origin + new URL(mcpUrl).pathname,
    serverInfo: client.getServerVersion() ?? null,
    toolName: "signoz_aggregate_traces",
    capturedAt: new Date().toISOString(),
    window: { start: new Date(start).toISOString(), end: new Date(end).toISOString() },
    serviceName,
    environmentName,
    route,
    baselineVersion,
    candidateVersion,
    baselineP95Ms: toMilliseconds(baselineP95Nanos),
    candidateP95Ms: toMilliseconds(candidateP95Nanos),
    baselineErrorRate,
    candidateErrorRate,
    traceIds,
    note:
      "Deployment correlation is evidence of temporal and version association, not proof of causation.",
  };

  const outputPath = join(root, "test", "fixtures", "signoz", "mcp-investigation.json");
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(investigation, null, 2)}\n`);

  console.log(`capture-mcp-fixture: wrote ${outputPath}`);
  console.log(
    `  ${baselineVersion.slice(0, 7)} p95 ${investigation.baselineP95Ms?.toFixed(1)}ms ` +
    `err ${investigation.baselineErrorRate?.toFixed(2)}%  ->  ` +
    `${candidateVersion.slice(0, 7)} p95 ${investigation.candidateP95Ms?.toFixed(1)}ms ` +
    `err ${investigation.candidateErrorRate?.toFixed(2)}%`,
  );
  console.log(`  ${traceIds.length} candidate trace ids`);
} finally {
  await client.close();
}
