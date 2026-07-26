#!/usr/bin/env node
/**
 * Validates and imports GreenLight's SigNoz dashboards and alert rules.
 *
 *   node scripts/signoz-assets.mjs validate   # schema only, no network
 *   node scripts/signoz-assets.mjs import     # validate, then round-trip
 *
 * Dashboard definitions use SigNoz's readable v6 resource model as their
 * source format. The pinned v0.134.0 UI only renders UI-native v5 dashboards,
 * so imports compile the definitions into the exact v5 shape emitted by the
 * UI and use the supported v1 dashboard API. `import` posts or updates each
 * dashboard, reads it back, executes every panel through Query Builder v5, and
 * records the resulting stable IDs.
 */
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DASHBOARD_DIR = join(ROOT, "signoz", "dashboards");
const ALERT_DIR = join(ROOT, "signoz", "alerts");
const DASHBOARD_ID_PATH = join(ROOT, ".workloads", "signoz-dashboard-ids.json");

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
const PANEL_TYPES = new Map([
  ["signoz/BarChartPanel", "bar"],
  ["signoz/HistogramPanel", "histogram"],
  ["signoz/ListPanel", "list"],
  ["signoz/NumberPanel", "value"],
  ["signoz/PieChartPanel", "pie"],
  ["signoz/TablePanel", "table"],
  ["signoz/TimeSeriesPanel", "graph"],
]);

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
    if (variable.spec.value === undefined || variable.spec.value === "") {
      fail(file, `variable ${index}: spec.value must be a non-empty import default`);
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
      // A duration aggregation returns nanoseconds. Rendered without a unit
      // SigNoz prints the raw integer, so a p95 of 8.17ms reads as "8170000"
      // and the axis is unreadable at a glance — which for a panel whose whole
      // job is to make a latency change legible defeats the panel.
      const aggregatesDuration = spec.aggregations
        .some((aggregation) => String(aggregation.expression ?? "").includes("duration_nano"));
      if (aggregatesDuration && panel.spec.unit !== "ns") {
        fail(file, `${where}: a duration aggregation must declare spec.unit "ns"`);
      }
      if (panel.spec.unit !== undefined && typeof panel.spec.unit !== "string") {
        fail(file, `${where}: spec.unit must be a SigNoz y-axis unit string`);
      }
      for (const [groupIndex, field] of (spec.groupBy ?? []).entries()) {
        if (!field.name || !field.fieldDataType) {
          fail(file, `${where} query ${index} groupBy ${groupIndex}: name and fieldDataType are required`);
        }
        // Trace and log panels group by a resource or span field. Metric panels
        // group by a metric attribute, which is a third context; allowing
        // "attribute" everywhere would let a trace panel declare a context the
        // v5 UI cannot render, so the signal decides which set is legal.
        const contexts = spec.signal === "metrics"
          ? ["attribute", "resource"]
          : ["resource", "span"];
        if (!contexts.includes(field.fieldContext)) {
          fail(
            file,
            `${where} query ${index} groupBy ${groupIndex}: ` +
            `fieldContext must be ${contexts.map((c) => `"${c}"`).join(" or ")} ` +
            `for a ${spec.signal} panel in the v5 UI`,
          );
        }
      }
    }
  }
}

function stableUuid(value) {
  const hash = createHash("sha256").update(`greenlight-signoz:${value}`).digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `5${hash.slice(13, 16)}`,
    `a${hash.slice(17, 20)}`,
    hash.slice(20, 32),
  ].join("-");
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function expandVariables(file, expression, variables) {
  return expression.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_match, name) => {
    if (!variables.has(name)) {
      fail(file, `filter references variable $${name} without a non-empty default`);
    }
    return sqlLiteral(variables.get(name));
  });
}

// SigNoz v0.134.0 stores dashboards in the v5 shape but its panel renderer
// still reads group-by fields through the legacy attribute keys. A widget that
// carries only `name`/`fieldDataType`/`fieldContext` is saved and queryable
// through the API, yet the UI sends an empty group-by key and the panel fails
// with "invalid empty key name for group by". Emitting both key sets keeps the
// stored dashboard v5-native and renderable.
const LEGACY_FIELD_CONTEXTS = new Map([
  ["resource", "resource"],
  ["span", "tag"],
  // A metric attribute is a tag to the legacy panel renderer, the same as a
  // span attribute. Without this the compiled group-by key is `undefined` and
  // the panel renders one unlabelled series instead of one per attribute value.
  ["attribute", "tag"],
]);

function groupByField(spec, field) {
  const legacyContext = LEGACY_FIELD_CONTEXTS.get(field.fieldContext);
  return {
    ...field,
    signal: field.signal ?? spec.signal,
    key: field.name,
    dataType: field.fieldDataType,
    type: legacyContext,
    isColumn: false,
    isJSON: false,
    id: `${field.name}--${field.fieldDataType}--${legacyContext}--false`,
  };
}

function builderQueryData(file, spec, variables) {
  return {
    aggregations: spec.aggregations,
    dataSource: spec.signal,
    disabled: spec.disabled ?? false,
    expression: spec.name,
    filter: {
      expression: expandVariables(file, spec.filter?.expression ?? "", variables),
    },
    functions: spec.functions ?? [],
    groupBy: (spec.groupBy ?? []).map((field) => groupByField(spec, field)),
    having: { expression: spec.having?.expression ?? "" },
    legend: spec.legend ?? "",
    limit: spec.limit ?? null,
    orderBy: spec.orderBy ?? [],
    queryName: spec.name,
    source: spec.source ?? "",
    stepInterval: spec.stepInterval ?? null,
  };
}

function widgetDefaults(id, panel, queryData, queryId) {
  return {
    bucketCount: 30,
    bucketWidth: 0,
    columnUnits: {},
    contextLinks: { linksData: [] },
    customLegendColors: {},
    decimalPrecision: 2,
    description: panel.spec.display.description ?? "",
    fillMode: "none",
    fillSpans: false,
    id,
    isLogScale: false,
    legendPosition: "bottom",
    lineInterpolation: "spline",
    lineStyle: "solid",
    mergeAllActiveQueries: false,
    nullZeroValues: "zero",
    opacity: "1",
    panelTypes: PANEL_TYPES.get(panel.spec.plugin.kind),
    query: {
      builder: {
        queryData: [queryData],
        queryFormulas: [],
        queryTraceOperator: [],
      },
      clickhouse_sql: [{ disabled: false, legend: "", name: "A", query: "" }],
      id: queryId,
      promql: [{ disabled: false, legend: "", name: "A", query: "" }],
      queryType: "builder",
      unit: "",
    },
    selectedLogFields: [
      {
        dataType: "",
        fieldContext: "log",
        fieldDataType: "",
        isIndexed: false,
        name: "timestamp",
        signal: "logs",
        type: "log",
      },
      {
        dataType: "",
        fieldContext: "log",
        fieldDataType: "",
        isIndexed: false,
        name: "body",
        signal: "logs",
        type: "log",
      },
    ],
    selectedTracesFields: [
      {
        fieldContext: "resource",
        fieldDataType: "string",
        name: "service.name",
        signal: "traces",
      },
      {
        fieldContext: "span",
        fieldDataType: "string",
        name: "name",
        signal: "traces",
      },
      {
        fieldContext: "span",
        fieldDataType: "",
        name: "duration_nano",
        signal: "traces",
      },
      {
        fieldContext: "span",
        fieldDataType: "",
        name: "http_method",
        signal: "traces",
      },
      {
        fieldContext: "span",
        fieldDataType: "",
        name: "response_status_code",
        signal: "traces",
      },
    ],
    showPoints: false,
    softMax: 0,
    softMin: 0,
    spanGaps: true,
    stackedBarChart: false,
    thresholds: [],
    timePreferance: "GLOBAL_TIME",
    title: panel.spec.display.name,
    yAxisUnit: panel.spec.unit ?? "",
  };
}

/** Compiles the readable dashboard resource into SigNoz's UI-native v5 JSON. */
export function compileDashboard({ file, payload }) {
  validateDashboard({ file, payload });
  const variables = new Map(
    (payload.spec.variables ?? []).map((variable) => [
      variable.spec.name,
      variable.spec.value,
    ]),
  );
  const widgets = [];
  const layout = [];

  for (const [index, [panelName, panel]] of Object.entries(payload.spec.panels).entries()) {
    const querySpec = panel.spec.queries[0].spec.plugin.spec;
    const widgetId = stableUuid(`${payload.name}:panel:${panelName}`);
    const queryId = stableUuid(`${payload.name}:query:${panelName}`);
    const queryData = builderQueryData(file, querySpec, variables);
    widgets.push(widgetDefaults(widgetId, panel, queryData, queryId));
    layout.push({
      h: 6,
      i: widgetId,
      moved: false,
      static: false,
      w: 6,
      x: (index % 2) * 6,
      y: Math.floor(index / 2) * 6,
    });
  }

  return {
    layout,
    panelMap: {},
    title: payload.spec.display.name,
    uploadedGrafana: false,
    version: "v5",
    widgets,
  };
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
    fail(file, "error and total queries must use the same service/environment/route scope");
  }
  if (payload.condition.selectedQueryName !== "F1" || payload.condition.targetUnit !== "%") {
    fail(file, "error-rate alert must evaluate formula F1 as a percentage");
  }
}

/**
 * Reads an asset's declared scope into the map `expandVariables` consumes.
 *
 * Dashboards carry variables under `spec`; alert rules have no `spec`, so they
 * declare theirs at the top level. Both use the same shape so a scope reads the
 * same wherever it appears.
 */
function declaredVariables(file, variables) {
  const entries = new Map();
  for (const [index, variable] of (variables ?? []).entries()) {
    if (!variable.spec?.name) {
      fail(file, `variable ${index}: spec.name is required`);
    }
    if (variable.spec.value === undefined || variable.spec.value === "") {
      fail(file, `variable ${index}: spec.value must be a non-empty default`);
    }
    entries.set(variable.spec.name, variable.spec.value);
  }
  return entries;
}

/**
 * Resolves an alert rule's scope into the payload SigNoz will store.
 *
 * SigNoz substitutes variables into dashboard queries at render time; alert
 * rules have no equivalent, and an unresolved `$service` is stored verbatim as
 * part of the filter. The rule is then accepted, listed, and permanently
 * inactive, because nothing matches a literal `$service`. Expanding here keeps
 * the scope declared once and readable while guaranteeing what reaches SigNoz
 * can actually match spans.
 */
export function compileAlert({ file, payload }) {
  const variables = declaredVariables(file, payload.variables);
  const queries = (payload.condition?.compositeQuery?.queries ?? []).map((query) => {
    const expression = query.spec?.filter?.expression;
    if (typeof expression !== "string") {
      return query;
    }
    return {
      ...query,
      spec: {
        ...query.spec,
        filter: { ...query.spec.filter, expression: expandVariables(file, expression, variables) },
      },
    };
  });

  // `variables` is GreenLight's own field, describing the scope to expand.
  // SigNoz never sees it, so it is dropped rather than forwarded.
  const rule = { ...payload };
  delete rule.variables;
  return {
    ...rule,
    condition: {
      ...payload.condition,
      compositeQuery: { ...payload.condition.compositeQuery, queries },
    },
  };
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

  // Compiling proves every referenced variable has a value. Re-reading the
  // result proves none survived, because a rule that reaches SigNoz holding a
  // literal `$service` is accepted, listed, and permanently unable to fire.
  const compiled = compileAlert({ file, payload });
  for (const query of compiled.condition.compositeQuery.queries) {
    const expression = query.spec?.filter?.expression;
    if (typeof expression === "string" && /\$[A-Za-z_]/.test(expression)) {
      fail(file, `filter still contains an unexpanded variable after compilation: ${expression}`);
    }
  }

  // An alert scoped to one immutable service.version can only ever describe a
  // version that was already deployed when the rule was written, so it cannot
  // warn about the next one. Alerts follow the environment and route; deciding
  // what a specific version did is the receipt's job, not the alert's.
  for (const query of compiled.condition.compositeQuery.queries) {
    if (query.spec?.filter?.expression?.includes("service.version")) {
      fail(
        file,
        "alert filters must not pin service.version; a version-scoped rule cannot fire for a future deployment",
      );
    }
  }
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

const V5_FIELD_CONTEXTS = new Map([
  ["resource", "resource"],
  ["tag", "span"],
]);

/**
 * Rebuilds a stored group-by exactly as the SigNoz panel renderer does.
 *
 * The renderer reads the legacy `key`/`dataType`/`type` attribute fields, not
 * the v5 `name`/`fieldDataType`/`fieldContext` ones. Deriving the request the
 * same way makes this check fail on the same input the browser fails on,
 * instead of passing because the API tolerates the v5-only shape.
 */
export function renderedGroupBy(storedGroupBy) {
  return (storedGroupBy ?? []).map((field) => ({
    name: field.key,
    fieldDataType: field.dataType ?? "",
    fieldContext: V5_FIELD_CONTEXTS.get(field.type) ?? "",
    signal: field.signal,
  }));
}

async function validateDashboardPanels(baseUrl, apiKey, dashboard) {
  const end = Date.now() + 60_000;
  const start = end - 6 * 60 * 60 * 1000;
  const results = [];

  for (const widget of dashboard.widgets) {
    const query = widget.query.builder.queryData[0];
    const body = {
      schemaVersion: "v1",
      start,
      end,
      requestType: widget.panelTypes === "value" ? "scalar" : "time_series",
      compositeQuery: {
        queries: [{
          type: "builder_query",
          spec: {
            name: query.queryName,
            signal: query.dataSource,
            disabled: query.disabled,
            aggregations: query.aggregations,
            filter: query.filter,
            functions: query.functions,
            groupBy: renderedGroupBy(query.groupBy),
            having: query.having,
            legend: query.legend,
            limit: query.limit,
            order: query.orderBy,
            stepInterval: query.stepInterval,
          },
        }],
      },
    };
    const response = await signozRequest(baseUrl, apiKey, "/api/v5/query_range", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!response.ok || response.body?.status === "error") {
      throw new Error(
        `Panel "${widget.title}" query failed (HTTP ${response.status}): ` +
        JSON.stringify(response.body?.error ?? response.body),
      );
    }
    const result = response.body?.data?.data?.results?.[0];
    if (result?.error) {
      throw new Error(
        `Panel "${widget.title}" query returned an error: ${JSON.stringify(result.error)}`,
      );
    }
    const aggregateSeries = (result?.aggregations ?? [])
      .flatMap((aggregation) => aggregation.series ?? []);
    const rawSeries = Array.isArray(result?.data) ? result.data : [];
    results.push({
      title: widget.title,
      series: aggregateSeries.length || rawSeries.length,
    });
  }
  return results;
}

/**
 * Creates or updates a UI-native dashboard by title.
 *
 * PUT preserves the ID already shared by receipts and demo documentation.
 */
export async function replaceDashboard(baseUrl, apiKey, asset) {
  const dashboard = compileDashboard(asset);
  const existing = await signozRequest(baseUrl, apiKey, "/api/v1/dashboards");
  if (!existing.ok) {
    throw new Error(`Could not list dashboards (HTTP ${existing.status})`);
  }
  const matches = (existing.body?.data ?? [])
    .filter((candidate) => candidate.data?.title === dashboard.title);
  if (matches.length > 1) {
    throw new Error(
      `Dashboard title "${dashboard.title}" is ambiguous (${matches.length} existing dashboards)`,
    );
  }
  const current = matches[0];
  const path = current
    ? `/api/v1/dashboards/${current.id}`
    : "/api/v1/dashboards";
  const saved = await signozRequest(baseUrl, apiKey, path, {
    method: current ? "PUT" : "POST",
    body: JSON.stringify(dashboard),
  });
  if (!saved.ok) {
    throw new Error(
      `SigNoz rejected dashboard "${dashboard.title}" (HTTP ${saved.status}): ` +
      JSON.stringify(saved.body?.error ?? saved.body),
    );
  }
  const id = saved.body?.data?.id ?? current?.id;
  const readBack = await signozRequest(baseUrl, apiKey, `/api/v1/dashboards/${id}`);
  if (!readBack.ok) {
    throw new Error(`Imported dashboard "${dashboard.title}" could not be read back`);
  }
  const stored = readBack.body?.data?.data;
  const panelCount = stored?.widgets?.length ?? 0;
  const expected = dashboard.widgets.length;
  if (panelCount !== expected) {
    throw new Error(
      `Dashboard "${dashboard.title}" stored ${panelCount} panels but the asset defines ${expected}`,
    );
  }
  const storedWidgetIds = new Set((stored.widgets ?? []).map((widget) => widget.id));
  const layoutMatches = (stored.layout ?? [])
    .every((item) => storedWidgetIds.has(item.i));
  if ((stored.layout?.length ?? 0) !== expected || !layoutMatches) {
    throw new Error(`Dashboard "${dashboard.title}" stored an invalid panel layout`);
  }
  const panelResults = await validateDashboardPanels(baseUrl, apiKey, dashboard);
  return { id, panelCount, panelResults, title: dashboard.title };
}

function writeDashboardIds(baseUrl, imported) {
  mkdirSync(dirname(DASHBOARD_ID_PATH), { recursive: true });
  const dashboards = Object.fromEntries(
    imported.map(({ file, id, panelCount, title }) => [
      file.replace(/\.json$/, ""),
      {
        id,
        title,
        panelCount,
        url: new URL(`/dashboard/${id}`, baseUrl).toString(),
      },
    ]),
  );
  writeFileSync(
    DASHBOARD_ID_PATH,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), dashboards }, null, 2)}\n`,
    { mode: 0o600 },
  );
}

const ALERT_CHANNEL_NAME = "greenlight-receiver";

/**
 * Ensures a notification channel exists, and returns its name.
 *
 * SigNoz refuses to store a rule with no channel ("at least one channel is
 * required"), so without this the alert rules simply never import and the
 * product ships with an empty Alerts page. The channel points at GreenLight's
 * own receiver, which is where an alert about a deployed version should land:
 * the system that can say which change was running when it fired.
 *
 * An operator-supplied SIGNOZ_ALERT_CHANNELS wins, so a real deployment can
 * route to Slack or PagerDuty without touching this.
 */
async function ensureAlertChannel(baseUrl, apiKey, webhookUrl, webhookKey) {
  const existing = await signozRequest(baseUrl, apiKey, "/api/v1/channels");
  const found = (existing.body?.data ?? []).find((channel) => channel.name === ALERT_CHANNEL_NAME);
  if (found) {
    return ALERT_CHANNEL_NAME;
  }

  const created = await signozRequest(baseUrl, apiKey, "/api/v1/channels", {
    method: "POST",
    body: JSON.stringify({
      name: ALERT_CHANNEL_NAME,
      type: "webhook",
      webhook_configs: [{
        send_resolved: true,
        url: webhookUrl,
        // The username is the key's id and the password is the key itself, so
        // the webhook uses an ordinary scoped API key rather than a second kind
        // of secret.
        http_config: {
          basic_auth: { username: "signoz-alert-webhook", password: webhookKey },
        },
      }],
    }),
  });
  if (!created.ok) {
    throw new Error(
      `SigNoz rejected the "${ALERT_CHANNEL_NAME}" channel (HTTP ${created.status}): ` +
      JSON.stringify(created.body?.error ?? created.body),
    );
  }
  return ALERT_CHANNEL_NAME;
}

async function replaceAlert(baseUrl, apiKey, asset, channels) {
  const payload = compileAlert(asset);
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

  const importedDashboards = [];
  for (const asset of dashboards) {
    const result = await replaceDashboard(baseUrl, apiKey, asset);
    importedDashboards.push({ file: asset.file, ...result });
    const nonEmptyPanels = result.panelResults.filter((panel) => panel.series > 0).length;
    console.log(
      `signoz-assets: imported ${asset.file} as ${result.id} ` +
      `(${result.panelCount} panels; ${nonEmptyPanels} returned series)`,
    );
  }
  writeDashboardIds(baseUrl, importedDashboards);
  console.log(`signoz-assets: recorded dashboard IDs in ${DASHBOARD_ID_PATH}`);

  // SigNoz will not store a rule without a channel, so one is provisioned
  // rather than skipping the alerts and shipping an empty Alerts page.
  if (channels.length === 0) {
    const webhookKey = requireEnv("GREENLIGHT_ALERT_WEBHOOK_KEY");
    const webhookUrl = process.env.GREENLIGHT_ALERT_WEBHOOK_URL ??
      "http://host.docker.internal:4000/api/v1/integrations/signoz/alerts";
    channels.push(await ensureAlertChannel(baseUrl, apiKey, webhookUrl, webhookKey));
    console.log(`signoz-assets: using notification channel "${channels[0]}" -> ${webhookUrl}`);
  }
  for (const asset of alerts) {
    const { id } = await replaceAlert(baseUrl, apiKey, asset, channels);
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
