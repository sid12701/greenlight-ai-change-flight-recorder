#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = new URL("..", import.meta.url).pathname;
export const expectedImages = {
  SIGNOZ_IMAGE: "signoz/signoz:v0.134.0",
  SIGNOZ_OTEL_COLLECTOR_IMAGE:
    "signoz/signoz-otel-collector:v0.144.6",
  SIGNOZ_MCP_IMAGE: "signoz/signoz-mcp-server:v0.9.0",
  SIGNOZ_POSTGRES_IMAGE: "postgres:16.14-trixie",
  SIGNOZ_CLICKHOUSE_IMAGE: "clickhouse/clickhouse-server:25.12.5",
  SIGNOZ_CLICKHOUSE_KEEPER_IMAGE:
    "clickhouse/clickhouse-keeper:25.12.5",
};

export function parseImageEnv(content) {
  const values = new Map();
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separator = line.indexOf("=");
    if (separator < 1) {
      throw new Error(`invalid image env line: ${rawLine}`);
    }
    values.set(line.slice(0, separator), line.slice(separator + 1));
  }
  return values;
}

export function validatePins(casting, values) {
  const failures = [];
  if (/\bimage:\s*\S*:latest\b/.test(casting)) {
    failures.push("Foundry manifests contain a latest image");
  }
  if (/^\s*version:\s*latest\s*$/m.test(casting)) {
    failures.push("Foundry manifests contain a latest version");
  }
  for (const [key, taggedImage] of Object.entries(expectedImages)) {
    const value = values.get(key);
    if (!value) {
      failures.push(`${key} is missing`);
      continue;
    }
    const escaped = taggedImage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!new RegExp(`^${escaped}@sha256:[0-9a-f]{64}$`).test(value)) {
      failures.push(`${key} must pin ${taggedImage} by sha256 digest`);
    }
    if (!casting.includes(`image: ${taggedImage}`)) {
      failures.push(`casting.yaml does not pin ${taggedImage}`);
    }
  }
  if (failures.length) {
    throw new Error(failures.join("\n"));
  }
}

export async function validateStackPins() {
  const [casting, lock, imageEnv, foundryVersion, override] = await Promise.all([
    readFile(join(root, "casting.yaml"), "utf8"),
    readFile(join(root, "casting.yaml.lock"), "utf8"),
    readFile(join(root, "deploy/signoz-images.env"), "utf8"),
    readFile(join(root, "deploy/foundry.version"), "utf8"),
    readFile(join(root, "deploy/signoz-compose.override.yaml"), "utf8"),
  ]);
  if (foundryVersion.trim() !== "v0.2.16") {
    throw new Error("deploy/foundry.version must pin v0.2.16");
  }
  const values = parseImageEnv(imageEnv);
  validatePins(`${casting}\n${lock}`, values);
  if (!override.includes("SIGNOZ_TOKENIZER_JWT_SECRET:")) {
    throw new Error(
      "SigNoz override must configure SIGNOZ_TOKENIZER_JWT_SECRET",
    );
  }
  if (override.includes("SIGNOZ_JWT_SECRET:")) {
    throw new Error("SigNoz override uses deprecated SIGNOZ_JWT_SECRET");
  }
  return values;
}

async function main() {
  await validateStackPins();
  console.log(
    `signoz-stack: ${Object.keys(expectedImages).length} compatible images are version- and digest-pinned`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      `signoz-stack: ${error instanceof Error ? error.message : error}`,
    );
    process.exitCode = 1;
  });
}
