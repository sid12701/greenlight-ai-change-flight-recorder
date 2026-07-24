import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { validateAlert } from "./signoz-assets.mjs";

const errorRatePath = join(import.meta.dirname, "..", "signoz", "alerts", "error-rate.json");

function readErrorRateAlert() {
  return JSON.parse(readFileSync(errorRatePath, "utf8"));
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
