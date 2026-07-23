#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), "../test/fixtures/signoz/mcp-investigation.json");

if (!existsSync(fixturePath)) {
  console.log("verify-mcp-result: fixture missing — run MCP demo and save sanitized output first");
  process.exit(0);
}

const payload = JSON.parse(readFileSync(fixturePath, "utf8"));
const text = JSON.stringify(payload).toLowerCase();

for (const key of ["serviceName", "serviceVersion", "route", "baselineP95Ms", "observedP95Ms", "traceIds"]) {
  if (!(key in payload)) {
    throw new Error(`Missing ${key} in MCP investigation fixture`);
  }
}

if (!Array.isArray(payload.traceIds) || payload.traceIds.length !== 3) {
  throw new Error("MCP fixture must include exactly three trace IDs");
}

if (text.includes("caused the") || text.includes("caused by the commit")) {
  throw new Error("MCP output must not claim causation");
}

console.log("verify-mcp-result: fixture validation passed");
