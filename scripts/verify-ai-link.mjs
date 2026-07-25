#!/usr/bin/env node
/**
 * Reports whether the AI-session link is armed, link by link.
 *
 * The chain from a coding session to a verified commit has four independent
 * parts, and any one of them being absent produces the same symptom on a
 * receipt: `AI link: missing`. That single word is honest but undiagnosable,
 * and the parts fail for unrelated reasons — telemetry not enabled, hook not
 * installed, propagation off, spans not reaching SigNoz. This names which one.
 *
 *   node scripts/verify-ai-link.mjs
 *
 * Exits non-zero when the chain cannot produce a verifiable link, so it can gate
 * a rehearsal. It never guesses: an unreachable SigNoz is reported as unknown
 * rather than as a missing span.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, readEnvFile } from "./lib/demo-runtime.mjs";

const log = (message) => console.log(`verify-ai-link: ${message}`);

/** Env vars Claude Code needs before it will export anything. */
const REQUIRED_TELEMETRY_ENV = [
  ["CLAUDE_CODE_ENABLE_TELEMETRY", "1"],
  ["CLAUDE_CODE_PROPAGATE_TRACEPARENT", "1"],
  ["OTEL_TRACES_EXPORTER", "otlp"],
  ["OTEL_EXPORTER_OTLP_PROTOCOL", "http/protobuf"],
];

const ENV_TEMPLATE = "instrumentation/claude-code/env.example";

function checkHookInstalled() {
  const hookPath = join(ROOT, ".git/hooks/prepare-commit-msg");
  if (!existsSync(hookPath)) {
    return {
      ok: false,
      detail: "the prepare-commit-msg hook is not installed",
      remedy: "npm run ai-link:arm",
    };
  }
  const installed = readFileSync(hookPath, "utf8");
  if (!installed.includes("AI-Traceparent")) {
    return {
      ok: false,
      detail: "a different prepare-commit-msg hook is installed",
      remedy: "inspect .git/hooks/prepare-commit-msg, then run: npm run ai-link:arm",
    };
  }
  return { ok: true, detail: "prepare-commit-msg will add an AI-Traceparent trailer" };
}

function checkTelemetryEnv() {
  const missing = REQUIRED_TELEMETRY_ENV
    .filter(([key, value]) => process.env[key] !== value)
    .map(([key, value]) => `${key}=${value}`);
  if (missing.length > 0) {
    return {
      ok: false,
      detail: `this shell is missing ${missing.join(", ")}`,
      remedy: `source ${ENV_TEMPLATE} in the shell that runs Claude Code, then restart it`,
    };
  }
  return { ok: true, detail: "Claude Code telemetry exports are set in this shell" };
}

function checkTraceparent() {
  const traceparent = process.env.TRACEPARENT;
  if (!traceparent) {
    return {
      ok: false,
      detail: "TRACEPARENT is not set, so a commit made here carries no session context",
      remedy:
        "run this from inside a Claude Code session started with the telemetry exports set; " +
        "Claude Code sets TRACEPARENT for the commands it runs",
    };
  }
  const normalized = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/.exec(
    traceparent.trim().toLowerCase(),
  );
  if (!normalized) {
    return {
      ok: false,
      detail: `TRACEPARENT is set but not a valid W3C context: ${traceparent}`,
      remedy: "check the exporting tool; the hook will refuse to record an invalid context",
    };
  }
  return {
    ok: true,
    detail: `session context present (trace ${normalized[1]})`,
    traceId: normalized[1],
  };
}

/**
 * Asks SigNoz whether the coding agent's service is producing spans at all.
 *
 * Verification of a specific commit's span happens in the worker; this only
 * answers the prior question — is anything arriving — because that is what
 * distinguishes "no session was recorded" from "the exporter is not working".
 */
async function checkSignozSpans(serviceName) {
  const apiKey = process.env.SIGNOZ_API_KEY;
  if (!apiKey) {
    return {
      ok: null,
      detail: "SIGNOZ_API_KEY is not set, so SigNoz was not asked",
      remedy: "set -a && . ./.env.demo && set +a",
    };
  }
  const signozUrl = process.env.SIGNOZ_URL ?? "http://127.0.0.1:8080";
  const end = Date.now();
  const start = end - 24 * 60 * 60 * 1_000;

  let response;
  try {
    response = await fetch(new URL("/api/v5/query_range", signozUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json", "SIGNOZ-API-KEY": apiKey },
      body: JSON.stringify({
        schemaVersion: "v1",
        start,
        end,
        requestType: "scalar",
        compositeQuery: {
          queries: [{
            type: "builder_query",
            spec: {
              name: "A",
              signal: "traces",
              disabled: false,
              filter: { expression: `service.name = '${serviceName}'` },
              aggregations: [{ expression: "count()" }],
            },
          }],
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    return {
      ok: null,
      detail: `SigNoz could not be reached: ${error instanceof Error ? error.message : error}`,
      remedy: "npm run demo:status",
    };
  }
  if (!response.ok) {
    return {
      ok: null,
      detail: `SigNoz returned HTTP ${response.status}`,
      remedy: "check SIGNOZ_API_KEY in .env.demo",
    };
  }
  const body = await response.json();
  const spans = Number(body?.data?.data?.results?.[0]?.data?.[0]?.at(-1) ?? 0);
  if (!Number.isFinite(spans) || spans < 1) {
    return {
      ok: false,
      detail: `SigNoz holds no spans for service.name = '${serviceName}' in the last 24h`,
      remedy:
        `start Claude Code with ${ENV_TEMPLATE} sourced and make one commit; ` +
        "without a span in SigNoz a receipt cannot mark the link verified",
    };
  }
  return { ok: true, detail: `SigNoz holds ${spans} spans for '${serviceName}'` };
}

function recordedLinkStates() {
  const demoEnv = readEnvFile(join(ROOT, ".env.demo"));
  const apiBase = process.env.GREENLIGHT_API_BASE ?? "http://127.0.0.1:4000";
  return { apiBase, serviceName: demoEnv.get("CLAUDE_OTEL_SERVICE_NAME") ?? "claude-code" };
}

/** Reports what the recorded commits currently say, for context. */
async function reportRecordedChanges(apiBase) {
  try {
    const response = await fetch(`${apiBase}/api/v1/changes`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return;
    const { changes } = await response.json();
    const states = new Map();
    for (const change of changes ?? []) {
      states.set(
        change.aiVerificationState,
        (states.get(change.aiVerificationState) ?? 0) + 1,
      );
    }
    const summary = [...states].map(([state, count]) => `${count} ${state}`).join(", ");
    log(`recorded changes: ${summary || "none"}`);
  } catch {
    // The API not running is not an AI-link failure.
  }
}

async function main() {
  const { apiBase, serviceName } = recordedLinkStates();
  const checks = [
    ["git hook", checkHookInstalled()],
    ["telemetry exports", checkTelemetryEnv()],
    ["session context", checkTraceparent()],
    ["spans in SigNoz", await checkSignozSpans(serviceName)],
  ];

  let armed = true;
  for (const [name, result] of checks) {
    const mark = result.ok === true ? "ok  " : result.ok === null ? "?   " : "FAIL";
    log(`${mark} ${name}: ${result.detail}`);
    if (result.ok !== true && result.remedy) {
      log(`       remedy: ${result.remedy}`);
    }
    if (result.ok !== true) {
      armed = false;
    }
  }

  await reportRecordedChanges(apiBase);

  if (!armed) {
    throw new Error(
      "the AI-session link is not fully armed; a commit made now would be recorded as `missing`",
    );
  }
  log("every link is armed: a commit made from this shell can be verified end to end");
  log(`current HEAD trailer: ${headTrailer() ?? "none"}`);
}

function headTrailer() {
  try {
    const message = execFileSync("git", ["log", "-1", "--format=%B"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    return /^AI-Traceparent:\s*(\S+)$/m.exec(message)?.[1] ?? null;
  } catch {
    return null;
  }
}

main().catch((error) => {
  console.error(`verify-ai-link: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
