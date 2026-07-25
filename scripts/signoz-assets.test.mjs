import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  compileDashboard,
  renderedGroupBy,
  replaceDashboard,
  validateAlert,
} from "./signoz-assets.mjs";

const errorRatePath = join(import.meta.dirname, "..", "signoz", "alerts", "error-rate.json");
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

test("the validator rejects mismatched error and total scopes", () => {
  const payload = readErrorRateAlert();
  const total = payload.condition.compositeQuery.queries
    .find((query) => query.spec.name === "B");
  total.spec.filter.expression = total.spec.filter.expression.replace("$route", "'/wrong'");

  assert.throws(
    () => validateAlert({ file: "error-rate.json", payload }),
    /same service\/version\/environment\/route scope/,
  );
});

test("dashboard definitions compile deterministically to UI-native v5 widgets", () => {
  const first = compileDashboard(dashboardAsset());
  const second = compileDashboard(dashboardAsset());

  assert.deepEqual(first, second);
  assert.equal(first.version, "v5");
  assert.equal(first.title, "GreenLight — Deployment Impact");
  assert.equal(first.widgets.length, 5);
  assert.equal(first.layout.length, first.widgets.length);
  assert.ok(first.layout.every((item) => first.widgets.some((widget) => widget.id === item.i)));
  assert.ok(first.widgets.every((widget) => widget.panelTypes === "graph"));
  assert.ok(first.widgets.every((widget) => widget.query.builder.queryData[0].dataSource === "traces"));

  const requestFilter = first.widgets[0].query.builder.queryData[0].filter.expression;
  assert.doesNotMatch(requestFilter, /\$/);
  assert.match(requestFilter, /service\.name = 'blnk-loan-workload'/);
  assert.match(
    requestFilter,
    /service\.version = 'c8fce93af4df6b1edb46ca97e570c55beff4cef9'/,
  );
  assert.match(requestFilter, /http\.route = '\/balances'/);
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
    assert.equal(result.panelCount, 5);
    assert.equal(result.panelResults.length, 5);
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
