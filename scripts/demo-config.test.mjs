import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  credentialFailures,
  ensureSecretFiles,
  materializeDemoEnvironment,
  parseEnv,
  validateSecretFile,
  validateTemplate,
} from "./demo-config.mjs";

const validTemplate = `
GITHUB_TOKEN=github-token-that-is-long-enough
GITHUB_REPOSITORY=owner/repository
SIGNOZ_API_KEY=signoz-key-that-is-long-enough
GREENLIGHT_ENV=development
GREENLIGHT_PORT=4000
GREENLIGHT_HOST=0.0.0.0
GREENLIGHT_SERVICE_VERSION=0.1.0
GREENLIGHT_API_KEYS=[]
GREENLIGHT_REQUIRE_READ_AUTH=false
GREENLIGHT_ALLOWED_ORIGINS=http://127.0.0.1:4173
GREENLIGHT_HEALTH_ALLOWED_ORIGINS=http://127.0.0.1:18081
GREENLIGHT_PRIMARY_WORKFLOW_NAME=CI
SIGNOZ_URL=http://127.0.0.1:8080
SIGNOZ_MCP_URL=http://127.0.0.1:8000/mcp
OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318
OTEL_SERVICE_NAME=greenlight-api
`;

test("demo environment parser rejects malformed and duplicate entries", () => {
  assert.throws(() => parseEnv("NO_SEPARATOR"), /not KEY=value/);
  assert.throws(() => parseEnv("A=1\nA=2"), /duplicate key/);
});

test("checked-in demo template is safe to source in a shell", () => {
  const template = readFileSync(
    join(import.meta.dirname, "..", ".env.demo.example"),
    "utf8",
  );
  for (const line of template.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) {
      continue;
    }
    const value = line.slice(line.indexOf("=") + 1);
    if (/\s/.test(value)) {
      assert.match(value, /^".*"$/, `unquoted whitespace in ${line}`);
    }
  }
});

test("demo environment distinguishes structure from external credentials", () => {
  const values = parseEnv(
    validTemplate
      .replace("github-token-that-is-long-enough", "<github-token>")
      .replace("signoz-key-that-is-long-enough", "<signoz-key>"),
  );
  assert.doesNotThrow(() => validateTemplate(values));
  assert.deepEqual(credentialFailures(values), [
    "GITHUB_TOKEN must be empty or a valid read-only token",
    "SIGNOZ_API_KEY is still missing or a placeholder",
  ]);
  values.set("GITHUB_TOKEN", "");
  assert.deepEqual(credentialFailures(values), [
    "SIGNOZ_API_KEY is still missing or a placeholder",
  ]);
  assert.deepEqual(credentialFailures(parseEnv(validTemplate)), []);
});

test("generated local secrets are strong, private, and idempotent", () => {
  const directory = mkdtempSync(join(tmpdir(), "greenlight-demo-secrets-"));
  try {
    const first = ensureSecretFiles(directory);
    const before = readFileSync(first.signozPath, "utf8");
    const second = ensureSecretFiles(directory);
    assert.equal(readFileSync(second.signozPath, "utf8"), before);
    assert.equal(statSync(first.signozPath).mode & 0o077, 0);
    assert.equal(statSync(first.greenlightPath).mode & 0o077, 0);
    const signozSecrets = parseEnv(readFileSync(first.signozPath, "utf8"));
    const rootPassword = signozSecrets.get("SIGNOZ_BOOTSTRAP_PASSWORD") ?? "";
    assert.match(rootPassword, /[A-Z]/);
    assert.match(rootPassword, /[a-z]/);
    assert.match(rootPassword, /[0-9]/);
    assert.match(rootPassword, /[^A-Za-z0-9]/);
    assert.doesNotThrow(() =>
      validateSecretFile(first.signozPath, [
        "SIGNOZ_POSTGRES_PASSWORD",
        "SIGNOZ_TOKENIZER_JWT_SECRET",
      ])
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("legacy migration overlays only the three external settings", () => {
  const template =
    "GITHUB_TOKEN=<token>\nGITHUB_REPOSITORY=owner/repo\nSIGNOZ_API_KEY=<key>\nGREENLIGHT_PORT=4000";
  const migrated = materializeDemoEnvironment(
    template,
    "GITHUB_TOKEN=legacy-github\nGITHUB_REPOSITORY=legacy/repo\nSIGNOZ_API_KEY=legacy-signoz\nGREENLIGHT_PORT=9999",
  );
  assert.equal(
    migrated,
    "GITHUB_TOKEN=legacy-github\nGITHUB_REPOSITORY=legacy/repo\nSIGNOZ_API_KEY=legacy-signoz\nGREENLIGHT_PORT=4000",
  );
});
