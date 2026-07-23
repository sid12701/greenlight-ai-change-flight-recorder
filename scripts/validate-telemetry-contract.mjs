#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), "../test/fixtures/signoz/baseline-query.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));

const required = ["serviceName", "serviceVersion", "environmentName", "route", "filters"];
for (const key of required) {
  if (!fixture[key]) {
    throw new Error(`Missing ${key} in baseline-query fixture`);
  }
}

if (fixture.route !== "/api/v1/internal/home/overview") {
  throw new Error("Route filter must target home overview");
}

if (fixture.serviceVersion.length !== 40) {
  throw new Error("service.version must be a full SHA");
}

console.log("baseline-query fixture validation passed");
