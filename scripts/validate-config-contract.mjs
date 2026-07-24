#!/usr/bin/env node
/**
 * Keeps `.env.example` honest against the configuration schema.
 *
 * The key list is derived from `AppConfigSchema` rather than maintained by
 * hand, so a new setting cannot be added to the application without also
 * appearing in the example a operator copies from. Node reads the TypeScript
 * source directly, so this runs without a build step.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AppConfigSchema } from "../apps/api/src/config.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env.example");
const envText = readFileSync(envPath, "utf8");

/** Unwraps effects/refinements to reach the underlying object shape. */
function objectShape(schema) {
  let current = schema;
  while (current?._def?.schema) {
    current = current._def.schema;
  }
  if (!current?.shape) {
    throw new Error("AppConfigSchema does not expose an object shape");
  }
  return current.shape;
}

function isOptional(field) {
  return field.isOptional?.() === true;
}

const shape = objectShape(AppConfigSchema);
const schemaKeys = Object.keys(shape);
const requiredKeys = schemaKeys.filter((key) => !isOptional(shape[key]));

const documentedKeys = envText
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"))
  .map((line) => line.split("=")[0].trim());

const duplicates = documentedKeys.filter(
  (key, index) => documentedKeys.indexOf(key) !== index,
);
const missing = requiredKeys.filter((key) => !documentedKeys.includes(key));
const unknown = documentedKeys.filter((key) => !schemaKeys.includes(key));

const failures = [];
if (duplicates.length > 0) {
  failures.push(`Duplicate keys in .env.example: ${[...new Set(duplicates)].join(", ")}`);
}
if (missing.length > 0) {
  failures.push(`Missing config keys in .env.example: ${missing.join(", ")}`);
}
if (unknown.length > 0) {
  failures.push(`Keys in .env.example that the schema does not accept: ${unknown.join(", ")}`);
}

// Values that look like real credentials must never be committed, even as
// examples: they get copied verbatim far more often than they get replaced.
const credentialFixtures = [
  "gho_abcdefghijklmnopqrstuvwxyz1234567890",
  "github_pat_abcdefghijklmnopqrstuvwxyz1234567890",
  "sk-abcdefghijklmnopqrstuvwxyz1234567890",
  "AKIAIOSFODNN7EXAMPLE",
  "-----BEGIN RSA PRIVATE KEY-----",
];
for (const fixture of credentialFixtures) {
  if (envText.includes(fixture)) {
    failures.push(`Credential-like fixture in .env.example: ${fixture.slice(0, 12)}...`);
  }
}

// A machine-specific absolute path in a shared example only ever works for the
// person who wrote it.
for (const line of envText.split("\n")) {
  const [key, ...rest] = line.split("=");
  const value = rest.join("=").trim();
  if (/^\/(Users|home)\//.test(value)) {
    failures.push(`${key.trim()} points at a machine-specific path: ${value}`);
  }
}

if (failures.length > 0) {
  throw new Error(`Config contract validation failed:\n- ${failures.join("\n- ")}`);
}

console.log(
  `Config contract validation passed: ${documentedKeys.length} documented keys, ` +
  `${requiredKeys.length} required by the schema.`,
);
