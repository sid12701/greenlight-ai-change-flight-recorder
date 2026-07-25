#!/usr/bin/env node
/**
 * Repository policy gate.
 *
 * Code style, unused code and type-safety are enforced by ESLint (`npm run
 * lint`); this gate covers only the invariants a linter cannot express:
 * forbidden production dependencies and committed credentials.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;

function trackedFiles() {
  return execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean)
    .filter((file) => existsSync(join(root, file)));
}

/**
 * Reading SigNoz's internal telemetry store bypasses the supported API and
 * produces evidence the product itself could never query, so a receipt built
 * that way would assert something a reader cannot reproduce.
 *
 * The rule names the telemetry store rather than `docker exec` in general.
 * Forbidding the command outright also caught operator tasks that administer
 * GreenLight's *own* database — clearing transient demo rows, rotating a local
 * password — which are not evidence at all. It also gave false confidence: a
 * blanket substring ban is satisfied by spawning `docker` with `exec` as an
 * argument, which is how the existing secret rotation already reaches psql.
 * Naming the store is both narrower and harder to evade by accident.
 */
const FORBIDDEN_PRODUCTION_DEPENDENCIES = [
  "SIGNOZ_CLICKHOUSE_CONTAINER",
  "distributed_signoz_index",
  "signoz_traces.",
  "signoz_metrics.",
  "signoz_logs.",
  "clickhouse-client",
];
const DIAGNOSTIC_ALLOWLIST = new Set(["scripts/quality-gates.mjs"]);

const CREDENTIAL_PATTERNS = [
  /ChangeMe123!/i,
  /GreenlightDemo123!/,
  /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/,
  /gh[pousr]_[A-Za-z0-9]{16,}/,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];
// Files that legitimately contain credential *patterns* rather than
// credentials: the scanners themselves, and audit documents that quote them.
const CREDENTIAL_ALLOWLIST = new Set([
  "docs/EVIDENCE_LOG.md",
  "docs/REMEDIATION_TRACKER.md",
  "planning/archive/remediation-list.md",
  "scripts/quality-gates.mjs",
  "scripts/validate-config-contract.mjs",
]);

const failures = [];
const files = trackedFiles();

// Only executable code is checked: documentation legitimately quotes these
// strings when recording why the dependency was removed.
const CODE_FILE = /\.(?:ts|tsx|js|mjs|cjs|sh|ya?ml)$/;
for (const file of files.filter((name) => CODE_FILE.test(name))) {
  if (DIAGNOSTIC_ALLOWLIST.has(file)) {
    continue;
  }
  const content = readFileSync(join(root, file), "utf8");
  for (const forbidden of FORBIDDEN_PRODUCTION_DEPENDENCIES) {
    if (content.includes(forbidden)) {
      failures.push(`${file}: forbidden telemetry-store dependency "${forbidden}"`);
    }
  }
}

for (const file of files) {
  if (CREDENTIAL_ALLOWLIST.has(file)) {
    continue;
  }
  const content = readFileSync(join(root, file), "utf8");
  for (const pattern of CREDENTIAL_PATTERNS) {
    if (pattern.test(content)) {
      failures.push(`${file}: possible committed credential (${pattern})`);
    }
  }
}

for (const file of files.filter((name) => name.endsWith(".sh"))) {
  try {
    execFileSync("bash", ["-n", file], { cwd: root, stdio: "pipe" });
  } catch {
    failures.push(`${file}: bash syntax check failed`);
  }
}

if (failures.length) {
  throw new Error(`quality gates failed:\n- ${failures.join("\n- ")}`);
}
console.log(`quality-gates: policy checks passed across ${files.length} tracked files`);
