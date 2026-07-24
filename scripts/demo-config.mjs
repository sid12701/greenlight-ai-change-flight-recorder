#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const placeholder = /<[^>]+>|replace|change-?me|placeholder|unconfigured/i;

export const requiredDemoKeys = [
  "GITHUB_TOKEN",
  "GITHUB_REPOSITORY",
  "SIGNOZ_API_KEY",
  "GREENLIGHT_ENV",
  "GREENLIGHT_PORT",
  "GREENLIGHT_HOST",
  "GREENLIGHT_SERVICE_VERSION",
  "GREENLIGHT_API_KEYS",
  "GREENLIGHT_REQUIRE_READ_AUTH",
  "GREENLIGHT_ALLOWED_ORIGINS",
  "GREENLIGHT_HEALTH_ALLOWED_ORIGINS",
  "GREENLIGHT_PRIMARY_WORKFLOW_NAME",
  "SIGNOZ_URL",
  "SIGNOZ_MCP_URL",
  "OTEL_EXPORTER_OTLP_ENDPOINT",
  "OTEL_SERVICE_NAME",
];

export function parseEnv(content) {
  const values = new Map();
  for (const [index, rawLine] of content.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separator = line.indexOf("=");
    if (separator < 1) {
      throw new Error(`line ${index + 1} is not KEY=value`);
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
      throw new Error(`line ${index + 1} has an invalid key: ${key}`);
    }
    if (values.has(key)) {
      throw new Error(`duplicate key: ${key}`);
    }
    values.set(key, value);
  }
  return values;
}

export function validateTemplate(values) {
  const failures = [];
  for (const key of new Set(requiredDemoKeys)) {
    if (!values.has(key)) {
      failures.push(`missing ${key}`);
    }
  }
  const repository = values.get("GITHUB_REPOSITORY") ?? "";
  if (!/^[^/\s]+\/[^/\s]+$/.test(repository)) {
    failures.push("GITHUB_REPOSITORY must be owner/repository");
  }
  for (const key of ["SIGNOZ_URL", "SIGNOZ_MCP_URL", "OTEL_EXPORTER_OTLP_ENDPOINT"]) {
    try {
      new URL(values.get(key) ?? "");
    } catch {
      failures.push(`${key} must be an absolute URL`);
    }
  }
  if (failures.length) {
    throw new Error(failures.join("; "));
  }
}

export function credentialFailures(values) {
  const failures = [];
  const githubToken = values.get("GITHUB_TOKEN") ?? "";
  if (
    githubToken &&
    (placeholder.test(githubToken) || githubToken.length < 20)
  ) {
    failures.push("GITHUB_TOKEN must be empty or a valid read-only token");
  }
  for (const [key, minimum] of [["SIGNOZ_API_KEY", 20]]) {
    const value = values.get(key) ?? "";
    if (placeholder.test(value) || value.length < minimum) {
      failures.push(`${key} is still missing or a placeholder`);
    }
  }
  return failures;
}

export function materializeDemoEnvironment(template, legacy) {
  const source = parseEnv(legacy);
  const requiredCredentials = ["GITHUB_REPOSITORY", "SIGNOZ_API_KEY"];
  for (const key of requiredCredentials) {
    if (!source.has(key)) {
      throw new Error(`legacy environment is missing ${key}`);
    }
  }
  const overlayKeys = ["GITHUB_TOKEN", ...requiredCredentials];
  return template
    .split(/\r?\n/)
    .map((line) => {
      const key = line.split("=", 1)[0].trim();
      const candidate = source.get(key) ?? "";
      return overlayKeys.includes(key) &&
          source.has(key) &&
          !(key === "GITHUB_TOKEN" && placeholder.test(candidate))
        ? `${key}=${source.get(key)}`
        : line;
    })
    .join("\n");
}

function randomSecret() {
  return randomBytes(32).toString("hex");
}

function strongPassword() {
  return `Gl!9${randomBytes(30).toString("hex")}`;
}

function writeSecretFile(path, values) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const content = [...values.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  writeFileSync(path, `${content}\n`, { encoding: "utf8", mode: 0o600 });
  chmodSync(path, 0o600);
}

function readContainerEnvironment(name) {
  try {
    return JSON.parse(
      execFileSync(
        "docker",
        ["inspect", name, "--format", "{{json .Config.Env}}"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      ),
    );
  } catch {
    return null;
  }
}

function environmentValue(environment, key) {
  return environment
    ?.find((entry) => entry.startsWith(`${key}=`))
    ?.slice(key.length + 1);
}

function adoptRunningSignoz(signozPath) {
  const signozEnvironment = readContainerEnvironment("signoz-signoz-0");
  const postgresEnvironment = readContainerEnvironment(
    "signoz-metastore-postgres-0",
  );
  if (!signozEnvironment || !postgresEnvironment) {
    return false;
  }

  const jwtSecret =
    environmentValue(signozEnvironment, "SIGNOZ_TOKENIZER_JWT_SECRET") ??
    environmentValue(signozEnvironment, "SIGNOZ_JWT_SECRET") ??
    randomSecret();
  const currentPassword =
    environmentValue(postgresEnvironment, "POSTGRES_PASSWORD");
  if (!currentPassword) {
    throw new Error("running SigNoz PostgreSQL password could not be adopted");
  }

  const nextPassword = randomSecret();
  const sql = [
    "BEGIN;",
    `ALTER ROLE signoz WITH PASSWORD '${nextPassword}';`,
    "UPDATE organizations SET name = 'greenlight-demo' WHERE name = '';",
    "COMMIT;",
    "",
  ].join("\n");
  const rotation = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      "signoz-metastore-postgres-0",
      "psql",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "signoz",
      "-d",
      "signoz",
    ],
    { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  );
  if (rotation.status !== 0) {
    throw new Error("running SigNoz PostgreSQL password rotation failed");
  }

  writeSecretFile(signozPath, new Map([
    ["SIGNOZ_POSTGRES_PASSWORD", nextPassword],
    ["SIGNOZ_TOKENIZER_JWT_SECRET", jwtSecret],
    ["SIGNOZ_BOOTSTRAP_EMAIL", "greenlight-admin@example.com"],
    ["SIGNOZ_BOOTSTRAP_PASSWORD", strongPassword()],
    ["SIGNOZ_BOOTSTRAP_NAME", "GreenLight-Demo"],
    ["SIGNOZ_BOOTSTRAP_ORG_NAME", "greenlight-demo"],
  ]));
  return true;
}

export function validateSecretFile(path, requiredKeys) {
  if (!existsSync(path)) {
    throw new Error(`secret file is missing: ${path}`);
  }
  const values = parseEnv(readFileSync(path, "utf8"));
  for (const key of requiredKeys) {
    const value = values.get(key) ?? "";
    if (value.length < 32 || placeholder.test(value)) {
      throw new Error(`${path}: ${key} is missing, short, or a placeholder`);
    }
  }
  if ((statSync(path).mode & 0o077) !== 0) {
    throw new Error(`${path} must not be readable by group or other users`);
  }
  return values;
}

export function ensureSecretFiles(base = root, adoptRunning = false) {
  const workloadDirectory = join(base, ".workloads");
  const signozPath = join(workloadDirectory, "signoz.env");
  const greenlightPath = join(workloadDirectory, "greenlight.env");

  if (!existsSync(signozPath)) {
    const adopted = adoptRunning && adoptRunningSignoz(signozPath);
    if (!adopted) {
      writeSecretFile(signozPath, new Map([
        ["SIGNOZ_POSTGRES_PASSWORD", randomSecret()],
        ["SIGNOZ_TOKENIZER_JWT_SECRET", randomSecret()],
        ["SIGNOZ_BOOTSTRAP_EMAIL", "greenlight-admin@example.com"],
        ["SIGNOZ_BOOTSTRAP_PASSWORD", strongPassword()],
        ["SIGNOZ_BOOTSTRAP_NAME", "GreenLight-Demo"],
        ["SIGNOZ_BOOTSTRAP_ORG_NAME", "greenlight-demo"],
      ]));
    }
  }
  const signozValues = parseEnv(readFileSync(signozPath, "utf8"));
  const rootPassword = signozValues.get("SIGNOZ_BOOTSTRAP_PASSWORD") ?? "";
  if (
    signozValues.get("SIGNOZ_BOOTSTRAP_EMAIL")?.endsWith(".invalid") ||
    !/[A-Z]/.test(rootPassword) ||
    !/[a-z]/.test(rootPassword) ||
    !/[0-9]/.test(rootPassword) ||
    !/[^A-Za-z0-9]/.test(rootPassword)
  ) {
    signozValues.set("SIGNOZ_BOOTSTRAP_EMAIL", "greenlight-admin@example.com");
    signozValues.set("SIGNOZ_BOOTSTRAP_PASSWORD", strongPassword());
    writeSecretFile(signozPath, signozValues);
  }
  if (!existsSync(greenlightPath)) {
    const databasePassword = randomSecret();
    writeSecretFile(greenlightPath, new Map([
      ["GREENLIGHT_ADMIN_TOKEN", randomSecret()],
      ["GREENLIGHT_POSTGRES_PASSWORD", databasePassword],
      [
        "GREENLIGHT_DATABASE_URL",
        `postgres://greenlight:${databasePassword}@postgres:5432/greenlight`,
      ],
    ]));
  }

  validateSecretFile(signozPath, [
    "SIGNOZ_POSTGRES_PASSWORD",
    "SIGNOZ_TOKENIZER_JWT_SECRET",
    "SIGNOZ_BOOTSTRAP_PASSWORD",
  ]);
  validateSecretFile(greenlightPath, [
    "GREENLIGHT_ADMIN_TOKEN",
    "GREENLIGHT_POSTGRES_PASSWORD",
  ]);
  return { signozPath, greenlightPath };
}

function readDemoFile(path) {
  if (!existsSync(path)) {
    throw new Error(
      `${path} is missing; run: cp .env.demo.example .env.demo`,
    );
  }
  const values = parseEnv(readFileSync(path, "utf8"));
  validateTemplate(values);
  return values;
}

function main() {
  const [command, pathArg, targetArg] = process.argv.slice(2);
  const demoPath = pathArg
    ? isAbsolute(pathArg) ? pathArg : join(process.cwd(), pathArg)
    : join(root, ".env.demo");
  if (command === "template") {
    readDemoFile(demoPath);
    console.log(`demo-config: template is structurally valid: ${demoPath}`);
    return;
  }
  if (command === "credentials") {
    const failures = credentialFailures(readDemoFile(demoPath));
    if (failures.length) {
      throw new Error(failures.join("; "));
    }
    console.log("demo-config: external credentials are configured");
    return;
  }
  if (command === "secrets") {
    const files = ensureSecretFiles(root, process.argv.includes("--adopt-running"));
    console.log(
      `demo-config: local secrets ready (${files.signozPath}, ${files.greenlightPath})`,
    );
    return;
  }
  if (command === "migrate") {
    if (!pathArg) {
      throw new Error("usage: demo-config.mjs migrate <legacy-env> [target]");
    }
    const sourcePath = isAbsolute(pathArg)
      ? pathArg
      : join(process.cwd(), pathArg);
    const targetPath = targetArg
      ? isAbsolute(targetArg) ? targetArg : join(process.cwd(), targetArg)
      : join(root, ".env.demo");
    const content = materializeDemoEnvironment(
      readFileSync(join(root, ".env.demo.example"), "utf8"),
      readFileSync(sourcePath, "utf8"),
    );
    writeFileSync(targetPath, content, { encoding: "utf8", mode: 0o600 });
    chmodSync(targetPath, 0o600);
    console.log(`demo-config: migrated legacy values to ${targetPath}`);
    return;
  }
  throw new Error(
    "usage: demo-config.mjs template|credentials [path] | secrets [--adopt-running] | migrate <legacy-env> [target]",
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    console.error(
      `demo-config: error: ${error instanceof Error ? error.message : error}`,
    );
    process.exitCode = 1;
  }
}
