import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const requiredKeys = [
  "GREENLIGHT_PORT",
  "GREENLIGHT_DATABASE_PATH",
  "GREENLIGHT_ADMIN_TOKEN",
  "GITHUB_TOKEN",
  "GITHUB_REPOSITORY",
  "SIGNOZ_URL",
  "SIGNOZ_API_KEY",
  "OTEL_EXPORTER_OTLP_ENDPOINT",
  "OTEL_SERVICE_NAME",
  "LMS_PATH",
  "LMS_DEMO_BRANCH",
  "GREENLIGHT_PRIMARY_WORKFLOW_NAME",
  "GREENLIGHT_BASELINE_WINDOW_SECONDS",
  "GREENLIGHT_WARMUP_SECONDS",
  "GREENLIGHT_OBSERVED_WINDOW_SECONDS",
  "GREENLIGHT_MIN_SPANS",
];

const envExamplePath = path.join(root, ".env.example");
const envText = fs.readFileSync(envExamplePath, "utf8");
const presentKeys = new Set(
  envText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split("=", 1)[0]),
);

const missing = requiredKeys.filter((key) => !presentKeys.has(key));
const extra = [...presentKeys].filter((key) => !requiredKeys.includes(key));

if (missing.length > 0) {
  throw new Error(`Missing config keys in .env.example: ${missing.join(", ")}`);
}

if (extra.length > 0) {
  throw new Error(`Unexpected config keys in .env.example: ${extra.join(", ")}`);
}

const credentialFixtures = [
  "gho_abcdefghijklmnopqrstuvwxyz1234567890",
  "github_pat_abcdefghijklmnopqrstuvwxyz1234567890",
  "sk-abcdefghijklmnopqrstuvwxyz1234567890",
  "AKIAIOSFODNN7EXAMPLE",
  "-----BEGIN RSA PRIVATE KEY-----",
];

for (const fixture of credentialFixtures) {
  if (envText.includes(fixture)) {
    throw new Error(`Credential-like fixture must not appear in .env.example: ${fixture.slice(0, 12)}...`);
  }
}

console.log(`Config contract validation passed: ${requiredKeys.length} keys in .env.example.`);
