import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  compileAlert,
  compileDashboard,
  renderedGroupBy,
  replaceDashboard,
  validateAlert,
} from "./signoz-assets.mjs";

const errorRatePath = join(import.meta.dirname, "..", "signoz", "alerts", "error-rate.json");
const regressionAlertPath = join(import.meta.dirname, "..", "signoz", "alerts", "regression.json");
const deploymentDashboardPath = join(
  import.meta.dirname,
  "..",
  "signoz",
  "dashboards",
  "deployment-impact.json",
);

function readErrorRateAlert() {
  return JSON.parse(readFileSync(errorRatePath, "utf8"));
}

function readDeploymentDashboard() {
  return JSON.parse(readFileSync(deploymentDashboardPath, "utf8"));
}

function dashboardAsset() {
  return {
    file: "deployment-impact.json",
    payload: readDeploymentDashboard(),
  };
}

test("the error-rate alert evaluates an error/total percentage formula", () => {
  assert.doesNotThrow(() => {
    validateAlert({ file: "error-rate.json", payload: readErrorRateAlert() });
  });
});

test("the validator rejects a traffic-count query disguised as an error rate", () => {
  const payload = readErrorRateAlert();
  payload.condition.compositeQuery.queries =
    payload.condition.compositeQuery.queries.filter((query) => query.spec.name === "A");
  payload.condition.compositeQuery.queries[0].spec.filter.expression =
    payload.condition.compositeQuery.queries[0].spec.filter.expression
      .replace(" AND has_error = true", "");
  payload.condition.selectedQueryName = "A";

  assert.throws(
    () => validateAlert({ file: "error-rate.json", payload }),
    /queries A \(errors\) and B \(total\)/,
  );
});

test("alert rules reach SigNoz with their scope resolved to literals", () => {
  // SigNoz substitutes variables into dashboard queries at render time. Alert
  // rules have no equivalent, so an unresolved `$service` is stored verbatim,
  // matches nothing, and leaves a rule that is listed but can never fire.
  for (const [file, path] of [
    ["error-rate.json", errorRatePath],
    ["regression.json", regressionAlertPath],
  ]) {
    const payload = JSON.parse(readFileSync(path, "utf8"));
    const compiled = compileAlert({ file, payload });

    assert.equal(compiled.variables, undefined, "GreenLight's own field must not be sent to SigNoz");
    for (const query of compiled.condition.compositeQuery.queries) {
      const expression = query.spec.filter?.expression;
      if (typeof expression !== "string") continue;
      assert.doesNotMatch(expression, /\$[A-Za-z_]/, `${file} left a variable unexpanded`);
      assert.match(expression, /service\.name = 'blnk-loan-workload'/);
    }
  }
});

test("the validator rejects an alert whose scope has no declared value", () => {
  const payload = readErrorRateAlert();
  payload.variables = payload.variables.filter((variable) => variable.spec.name !== "route");

  assert.throws(
    () => validateAlert({ file: "error-rate.json", payload }),
    /variable \$route without a non-empty default/,
  );
});

test("the validator rejects an alert pinned to one immutable service.version", () => {
  // A version-scoped rule can only describe a version that already existed when
  // the rule was written, so it cannot warn about the next deployment.
  const payload = readErrorRateAlert();
  for (const query of payload.condition.compositeQuery.queries) {
    if (query.spec.filter) {
      query.spec.filter.expression = query.spec.filter.expression
        .replace("service.name = $service", "service.name = $service AND service.version = 'abc'");
    }
  }

  assert.throws(
    () => validateAlert({ file: "error-rate.json", payload }),
    /must not pin service\.version/,
  );
});

test("the p95 alert threshold separates this route's healthy and regressed latency", () => {
  // A threshold above the regressed value can never fire; one below the healthy
  // value fires constantly. Both make the rule decoration rather than a signal.
  const payload = JSON.parse(readFileSync(regressionAlertPath, "utf8"));
  const targetMs = payload.condition.target / 1_000_000;

  assert.equal(payload.condition.targetUnit, "ns");
  assert.ok(targetMs > 1.44, `threshold ${targetMs}ms must sit above the healthy p95`);
  assert.ok(targetMs < 10.45, `threshold ${targetMs}ms must sit below the regressed p95`);
});

test("the validator rejects mismatched error and total scopes", () => {
  const payload = readErrorRateAlert();
  const total = payload.condition.compositeQuery.queries
    .find((query) => query.spec.name === "B");
  total.spec.filter.expression = total.spec.filter.expression.replace("$route", "'/wrong'");

  assert.throws(
    () => validateAlert({ file: "error-rate.json", payload }),
    /same service\/environment\/route scope/,
  );
});

test("latency panels declare a nanosecond axis so durations render readably", () => {
  const { widgets } = compileDashboard(dashboardAsset());
  const latency = widgets.filter((widget) => widget.title.toLowerCase().includes("p9"));

  assert.ok(latency.length > 0, "the dashboard should chart latency");
  for (const widget of latency) {
    assert.equal(widget.yAxisUnit, "ns", `${widget.title} must declare its unit`);
  }
});

test("the validator rejects a duration panel with no declared unit", () => {
  const payload = readDeploymentDashboard();
  delete payload.spec.panels["latency-p95"].spec.unit;

  assert.throws(
    () => compileDashboard({ file: "deployment-impact.json", payload }),
    /must declare spec\.unit "ns"/,
  );
});

test("the dashboard can compare two deployed versions on one chart", () => {
  // A panel pinned to a single service.version can only ever show one
  // deployment, so a before/after comparison is impossible to see. The
  // comparison the receipt asserts has to be drawable.
  const { widgets } = compileDashboard(dashboardAsset());
  const comparison = widgets.find((widget) => widget.title === "p95 by deployed version");

  assert.ok(comparison, "expected a version-comparison panel");
  const [query] = comparison.query.builder.queryData;
  assert.doesNotMatch(query.filter.expression, /service\.version/);
  assert.deepEqual(query.groupBy.map((field) => field.key), ["service.version"]);
});

test("the deployment dashboard opens on a version that has telemetry", () => {
  // The default is what a judge sees before touching anything. Pointing it at a
  // version that was never deployed renders every panel empty.
  const payload = readDeploymentDashboard();
  const version = payload.spec.variables
    .find((variable) => variable.spec.name === "version").spec.value;

  assert.match(version, /^[0-9a-f]{40}$/);
  assert.notEqual(
    version,
    "c8fce93af4df6b1edb46ca97e570c55beff4cef9",
    "the upstream Blnk commit is never deployed as a service.version",
  );
});

test("dashboard definitions compile deterministically to UI-native v5 widgets", () => {
  const first = compileDashboard(dashboardAsset());
  const second = compileDashboard(dashboardAsset());

  assert.deepEqual(first, second);
  assert.equal(first.version, "v5");
  assert.equal(first.title, "GreenLight — Deployment Impact");
  assert.equal(first.widgets.length, Object.keys(readDeploymentDashboard().spec.panels).length);
  assert.equal(first.layout.length, first.widgets.length);
  assert.ok(first.layout.every((item) => first.widgets.some((widget) => widget.id === item.i)));
  assert.ok(first.widgets.every((widget) => widget.panelTypes === "graph"));
  assert.ok(first.widgets.every((widget) => widget.query.builder.queryData[0].dataSource === "traces"));

  // Every filter is fully expanded, whichever panel it belongs to.
  for (const widget of first.widgets) {
    assert.doesNotMatch(widget.query.builder.queryData[0].filter.expression, /\$/);
  }

  // The single-version panels carry the declared default; the comparison panels
  // deliberately do not pin a version, so they are excluded here.
  const declaredVersion = readDeploymentDashboard().spec.variables
    .find((variable) => variable.spec.name === "version").spec.value;
  const singleVersion = first.widgets
    .map((widget) => widget.query.builder.queryData[0].filter.expression)
    .filter((expression) => expression.includes("service.version"));

  assert.ok(singleVersion.length > 0, "expected panels scoped to one deployed version");
  for (const expression of singleVersion) {
    assert.match(expression, /service\.name = 'blnk-loan-workload'/);
    assert.ok(expression.includes(`service.version = '${declaredVersion}'`));
    assert.match(expression, /http\.route = '\/balances'/);
  }
});

test("dashboard compilation rejects an unset import variable", () => {
  const asset = dashboardAsset();
  asset.payload.spec.variables[0].spec.value = "";

  assert.throws(
    () => compileDashboard(asset),
    /spec\.value must be a non-empty import default/,
  );
});

test("dashboard compilation rejects obsolete trace group contexts", () => {
  const asset = dashboardAsset();
  const groupBy =
    asset.payload.spec.panels["deployment-markers"].spec.queries[0]
      .spec.plugin.spec.groupBy[0];
  groupBy.fieldContext = "attribute";

  assert.throws(
    () => compileDashboard(asset),
    /fieldContext must be "resource" or "span" for the v5 UI/,
  );
});

test("compiled group-by fields carry the legacy keys the panel renderer reads", () => {
  const compiled = compileDashboard(dashboardAsset());
  const grouped = compiled.widgets
    .flatMap((widget) => widget.query.builder.queryData)
    .flatMap((query) => query.groupBy ?? []);

  assert.ok(grouped.length > 0, "the fixture needs at least one grouped panel");
  for (const field of grouped) {
    assert.equal(field.key, field.name);
    assert.equal(field.dataType, field.fieldDataType);
    assert.equal(field.type, field.fieldContext === "resource" ? "resource" : "tag");
    assert.equal(field.id, `${field.key}--${field.dataType}--${field.type}--false`);
  }
});

test("a v5-only group-by renders as the empty key SigNoz rejects", () => {
  const compiled = compileDashboard(dashboardAsset());
  const stored = compiled.widgets
    .flatMap((widget) => widget.query.builder.queryData)
    .flatMap((query) => query.groupBy ?? []);

  assert.deepEqual(
    renderedGroupBy(stored),
    stored.map((field) => ({
      name: field.name,
      fieldDataType: field.fieldDataType,
      fieldContext: field.fieldContext,
      signal: field.signal,
    })),
    "legacy keys must round-trip back to the v5 shape the API validates",
  );

  const legacyKeys = ["key", "dataType", "type", "id", "isColumn", "isJSON"];
  const v5Only = stored.map((field) =>
    Object.fromEntries(
      Object.entries(field).filter(([name]) => !legacyKeys.includes(name)),
    ),
  );
  for (const field of renderedGroupBy(v5Only)) {
    assert.equal(field.name, undefined);
    assert.equal(field.fieldDataType, "");
    assert.equal(field.fieldContext, "");
  }
});

test("dashboard import updates by title, preserves the ID, and executes every panel", async () => {
  const asset = dashboardAsset();
  const compiled = compileDashboard(asset);
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async (url, init = {}) => {
    const path = new URL(url).pathname;
    calls.push({ path, method: init.method ?? "GET", body: init.body });
    if (path === "/api/v1/dashboards" && !init.method) {
      return Response.json({
        status: "success",
        data: [{ id: "dashboard-stable-id", data: { title: compiled.title } }],
      });
    }
    if (path === "/api/v1/dashboards/dashboard-stable-id" && init.method === "PUT") {
      return Response.json({
        status: "success",
        data: { id: "dashboard-stable-id", data: JSON.parse(init.body) },
      });
    }
    if (path === "/api/v1/dashboards/dashboard-stable-id" && !init.method) {
      return Response.json({
        status: "success",
        data: { id: "dashboard-stable-id", data: compiled },
      });
    }
    if (path === "/api/v5/query_range" && init.method === "POST") {
      return Response.json({
        status: "success",
        data: {
          data: {
            results: [{
              aggregations: [{ series: [{ values: [{ timestamp: Date.now(), value: 1 }] }] }],
            }],
          },
        },
      });
    }
    return Response.json({ error: "unexpected request" }, { status: 500 });
  };

  try {
    const result = await replaceDashboard("http://signoz.test", "test-key", asset);
    assert.equal(result.id, "dashboard-stable-id");
    // Derived from the definition so adding a panel does not need a test edit.
    assert.equal(result.panelCount, compiled.widgets.length);
    assert.equal(result.panelResults.length, compiled.widgets.length);
    assert.ok(result.panelResults.every((panel) => panel.series === 1));
    assert.equal(
      calls.filter((call) => call.path === "/api/v5/query_range").length,
      compiled.widgets.length,
    );
    assert.ok(calls.some((call) => (
      call.path === "/api/v1/dashboards/dashboard-stable-id" && call.method === "PUT"
    )));
    assert.ok(!calls.some((call) => call.method === "DELETE"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
