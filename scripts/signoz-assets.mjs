#!/usr/bin/env node
/**
 * Validates and imports GreenLight's SigNoz dashboards and alert rules.
 *
 *   node scripts/signoz-assets.mjs validate   # schema only, no network
 *   node scripts/signoz-assets.mjs import     # validate, then round-trip
 *
 * `validate` checks the assets against the SigNoz v6 dashboard and v1 alert
 * schemas. That is a structural check only — it cannot prove SigNoz accepts
 * them, which is exactly the gap that let unimportable assets ship before.
 * `import` is the authoritative gate: it posts each asset to a real SigNoz,
 * reads it back, and fails loudly on rejection.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DASHBOARD_DIR = join(ROOT, "signoz", "dashboards");
const ALERT_DIR = join(ROOT, "signoz", "alerts");

const PANEL_PLUGINS = new Set([
  "signoz/BarChartPanel",
  "signoz/HistogramPanel",
  "signoz/ListPanel",
  "signoz/NumberPanel",
  "signoz/PieChartPanel",
  "signoz/TablePanel",
  "signoz/TimeSeriesPanel",
]);
const QUERY_PLUGINS = new Set([
  "signoz/BuilderQuery",
  "signoz/ClickHouseSQL",
  "signoz/CompositeQuery",
  "signoz/Formula",
  "signoz/PromQLQuery",
  "signoz/TraceOperator",
]);
const REQUEST_KINDS = new Set([
  "scalar",
  "time_series",
  "raw",
  "raw_stream",
  "trace",
  "distribution",
]);
const RFC1123 = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

function fail(assetPath, message) {
  throw new Error(`${assetPath}: ${message}`);
}

function readAssets(directory) {
  return readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => {
      const path = join(directory, file);
      return { file, path, payload: JSON.parse(readFileSync(path, "utf8")) };
    });
}

export function validateDashboard({ file, payload }) {
  if (payload.schemaVersion !== "v6") {
    fail(file, `schemaVersion must be "v6", got ${JSON.stringify(payload.schemaVersion)}`);
  }
  if (typeof payload.name !== "string" || !RFC1123.test(payload.name)) {
    fail(file, `name must be a lowercase RFC 1123 label, got ${JSON.stringify(payload.name)}`);
  }
  if (!payload.spec?.display?.name) {
    fail(file, "spec.display.name is required");
  }

  if (payload.spec.duration !== undefined && !/^\d+[smhdw]$/.test(payload.spec.duration)) {
    fail(file, `spec.duration must be a duration string such as "1h", got ${JSON.stringify(payload.spec.duration)}`);
  }
  for (const [index, variable] of (payload.spec.variables ?? []).entries()) {
    if (!["TextVariable", "ListVariable"].includes(variable.kind)) {
      fail(file, `variable ${index}: kind must be TextVariable or ListVariable`);
    }
    if (!variable.spec?.name) {
      fail(file, `variable ${index}: spec.name is required`);
    }
  }

  const panels = payload.spec.panels ?? {};
  if (Object.keys(panels).length === 0) {
    fail(file, "a dashboard must define at least one panel");
  }

  for (const [panelId, panel] of Object.entries(panels)) {
    const where = `panel "${panelId}"`;
    if (panel.kind !== "Panel") {
      fail(file, `${where}: kind must be "Panel"`);
    }
    if (!PANEL_PLUGINS.has(panel.spec?.plugin?.kind)) {
      fail(file, `${where}: unsupported panel plugin ${JSON.stringify(panel.spec?.plugin?.kind)}`);
    }
    if (!panel.spec?.display?.name) {
      fail(file, `${where}: spec.display.name is required`);
    }
    const queries = panel.spec?.queries ?? [];
    // SigNoz renders exactly one query per panel; a second one is silently
    // dropped at best and rejected at worst.
    if (queries.length !== 1) {
      fail(file, `${where}: a panel must define exactly one query, found ${queries.length}`);
    }
    for (const [index, query] of queries.entries()) {
      if (!REQUEST_KINDS.has(query.kind)) {
        fail(file, `${where} query ${index}: unsupported request kind ${JSON.stringify(query.kind)}`);
      }
      const plugin = query.spec?.plugin;
      if (!QUERY_PLUGINS.has(plugin?.kind)) {
        fail(file, `${where} query ${index}: unsupported query plugin ${JSON.stringify(plugin?.kind)}`);
      }
      const spec = plugin.spec ?? {};
      if (!spec.name) {
        fail(file, `${where} query ${index}: builder query needs a name`);
      }
      if (!Array.isArray(spec.aggregations) || spec.aggregations.length === 0) {
        fail(file, `${where} query ${index}: builder query needs at least one aggregation`);
      }
    }
  }
}

function validateErrorRateAlert(file, payload, queries) {
  if (file !== "error-rate.json") {
    return;
  }
  const errorQuery = queries.find((query) => query.spec?.name === "A");
  const totalQuery = queries.find((query) => query.spec?.name === "B");
  const formula = queries.find((query) => query.spec?.name === "F1");
  if (errorQuery?.type !== "builder_query" || totalQuery?.type !== "builder_query") {
    fail(file, "error-rate alert must define builder queries A (errors) and B (total)");
  }
  if (formula?.type !== "builder_formula" || formula.spec?.expression !== "A/B*100") {
    fail(file, "error-rate alert must select formula F1 with expression A/B*100");
  }
  const errorFilter = errorQuery.spec?.filter?.expression;
  const totalFilter = totalQuery.spec?.filter?.expression;
  if (typeof errorFilter !== "string" || !errorFilter.endsWith(" AND has_error = true")) {
    fail(file, "query A must count only errored spans using has_error = true");
  }
  if (errorFilter.slice(0, -" AND has_error = true".length) !== totalFilter) {
    fail(file, "error and total queries must use the same service/version/environment/route scope");
  }
  if (payload.condition.selectedQueryName !== "F1" || payload.condition.targetUnit !== "%") {
    fail(file, "error-rate alert must evaluate formula F1 as a percentage");
  }
}

export function validateAlert({ file, payload }) {
  for (const field of ["alert", "alertType", "ruleType", "evalWindow", "frequency"]) {
    if (!payload[field]) {
      fail(file, `${field} is required`);
    }
  }
  const condition = payload.condition;
  if (!condition) {
    fail(file, "condition is required");
  }
  for (const field of ["op", "target", "matchType", "selectedQueryName"]) {
    if (condition[field] === undefined) {
      fail(file, `condition.${field} is required`);
    }
  }
  const queries = condition.compositeQuery?.queries ?? [];
  if (queries.length === 0) {
    fail(file, "condition.compositeQuery.queries must contain at least one query");
  }
  const selected = queries.some((query) => query.spec?.name === condition.selectedQueryName);
  if (!selected) {
    fail(file, `condition.selectedQueryName "${condition.selectedQueryName}" matches no query`);
  }
  if (!Array.isArray(payload.preferredChannels)) {
    fail(file, "preferredChannels must be an array; the importer fills it from SIGNOZ_ALERT_CHANNELS");
  }
  if (payload.version !== "v5") {
    fail(file, `version must be "v5" for Query Builder v5 alerts`);
  }
  const names = queries.map((query) => query.spec?.name);
  if (names.some((name) => typeof name !== "string") || new Set(names).size !== names.length) {
    fail(file, "every alert query needs a unique spec.name");
  }
  validateErrorRateAlert(file, payload, queries);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required to import SigNoz assets`);
  }
  return value;
}

async function signozRequest(baseUrl, apiKey, path, init = {}) {
  const response = await fetch(new URL(path, baseUrl), {
    ...init,
    headers: { "Content-Type": "application/json", "SIGNOZ-API-KEY": apiKey, ...init.headers },
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = text;
  }
  return { status: response.status, ok: response.ok, body };
}

/** Replaces an existing asset with the same name so imports are repeatable. */
async function replaceDashboard(baseUrl, apiKey, payload) {
  const existing = await signozRequest(baseUrl, apiKey, "/api/v2/dashboards");
  if (!existing.ok) {
    throw new Error(`Could not list dashboards (HTTP ${existing.status})`);
  }
  for (const dashboard of existing.body?.data?.dashboards ?? []) {
    if (dashboard.name === payload.name) {
      await signozRequest(baseUrl, apiKey, `/api/v2/dashboards/${dashboard.id}`, {
        method: "DELETE",
      });
    }
  }
  const created = await signozRequest(baseUrl, apiKey, "/api/v2/dashboards", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (created.status !== 201) {
    throw new Error(
      `SigNoz rejected dashboard "${payload.name}" (HTTP ${created.status}): ` +
      JSON.stringify(created.body?.error ?? created.body),
    );
  }
  const id = created.body?.data?.id;
  const readBack = await signozRequest(baseUrl, apiKey, `/api/v2/dashboards/${id}`);
  if (!readBack.ok) {
    throw new Error(`Imported dashboard "${payload.name}" could not be read back`);
  }
  const panelCount = Object.keys(readBack.body?.data?.spec?.panels ?? {}).length;
  const expected = Object.keys(payload.spec.panels ?? {}).length;
  if (panelCount !== expected) {
    throw new Error(
      `Dashboard "${payload.name}" stored ${panelCount} panels but the asset defines ${expected}`,
    );
  }
  return { id, panelCount };
}

async function replaceAlert(baseUrl, apiKey, payload, channels) {
  const body = { ...payload, preferredChannels: channels };
  const existing = await signozRequest(baseUrl, apiKey, "/api/v2/rules");
  for (const rule of existing.body?.data ?? []) {
    if ((rule.alert ?? rule.data?.alert) === payload.alert) {
      await signozRequest(baseUrl, apiKey, `/api/v2/rules/${rule.id}`, { method: "DELETE" });
    }
  }
  const created = await signozRequest(baseUrl, apiKey, "/api/v2/rules", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!created.ok) {
    throw new Error(
      `SigNoz rejected alert "${payload.alert}" (HTTP ${created.status}): ` +
      JSON.stringify(created.body?.error ?? created.body),
    );
  }
  return { id: created.body?.data?.id };
}

async function main() {
  const command = process.argv[2] ?? "validate";
  const dashboards = readAssets(DASHBOARD_DIR);
  const alerts = readAssets(ALERT_DIR);

  dashboards.forEach(validateDashboard);
  alerts.forEach(validateAlert);
  console.log(
    `signoz-assets: validated ${dashboards.length} dashboards and ${alerts.length} alert rules`,
  );

  if (command === "validate") {
    return;
  }
  if (command !== "import") {
    throw new Error(`Unknown command "${command}"; expected "validate" or "import"`);
  }

  const baseUrl = process.env.SIGNOZ_URL ?? "http://localhost:8080";
  const apiKey = requireEnv("SIGNOZ_API_KEY");
  const channels = (process.env.SIGNOZ_ALERT_CHANNELS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const asset of dashboards) {
    const { id, panelCount } = await replaceDashboard(baseUrl, apiKey, asset.payload);
    console.log(`signoz-assets: imported ${asset.file} as ${id} (${panelCount} panels)`);
  }

  if (channels.length === 0) {
    console.warn(
      "signoz-assets: SIGNOZ_ALERT_CHANNELS is not set; skipping alert import " +
      "(SigNoz requires at least one notification channel)",
    );
    return;
  }
  for (const asset of alerts) {
    const { id } = await replaceAlert(baseUrl, apiKey, asset.payload, channels);
    console.log(`signoz-assets: imported ${asset.file} as rule ${id}`);
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(`signoz-assets: ${error.message}`);
    process.exitCode = 1;
  });
}
