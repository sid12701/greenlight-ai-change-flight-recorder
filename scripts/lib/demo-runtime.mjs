/**
 * Shared machinery for the scripted demo scenarios.
 *
 * Two scenarios drive the running stack: `demo-chain.mjs` records what a
 * commit did to the service, and `demo-dependency-failure.mjs` records what
 * GreenLight does when something the commit did not touch fails inside a
 * measured window. They share deployment, traffic and evaluation mechanics but
 * deliberately not their assertions, because the two are claiming different
 * things.
 *
 * Nothing here fabricates telemetry. Versions come from Git, CI runs come from
 * GitHub, and metrics come from whatever SigNoz observed.
 *
 * The timing is dictated by the API, not chosen here. A deployment's window
 * opens GREENLIGHT_WARMUP_SECONDS after it is recorded, runs for
 * GREENLIGHT_OBSERVED_WINDOW_SECONDS, and cannot be evaluated until a further
 * GREENLIGHT_INGESTION_DELAY_SECONDS has passed, so traffic is generated inside
 * that window and evaluation waits for it to close.
 */
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const SERVICE_NAME = "blnk-loan-workload";
export const ENVIRONMENT_NAME = "hackathon-demo";
export const ROUTE = "/balances";

// The API performs this check itself, and it runs in a container, so the
// workload has to be named the way that container reaches the host.
const HEALTH_URL = process.env.BLNK_HEALTH_URL ??
  "http://host.docker.internal:18081/health";

export function readEnvFile(path) {
  const values = new Map();
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return values;
  }
  for (const line of text.split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match) continue;
    values.set(match[1], match[2].replace(/^"(.*)"$/, "$1"));
  }
  return values;
}

const demoEnv = readEnvFile(join(ROOT, ".env.demo"));
const localEnv = readEnvFile(join(ROOT, ".workloads/greenlight.env"));

export const config = {
  apiBase: process.env.GREENLIGHT_API_BASE ?? "http://127.0.0.1:4000",
  token: localEnv.get("GREENLIGHT_ADMIN_TOKEN") ?? "",
  repository: demoEnv.get("GITHUB_REPOSITORY") ?? "",
  warmupSeconds: Number(demoEnv.get("GREENLIGHT_WARMUP_SECONDS") ?? 15),
  observedSeconds: Number(demoEnv.get("GREENLIGHT_OBSERVED_WINDOW_SECONDS") ?? 90),
  baselineSeconds: Number(demoEnv.get("GREENLIGHT_BASELINE_WINDOW_SECONDS") ?? 90),
  ingestionSeconds: Number(demoEnv.get("GREENLIGHT_INGESTION_DELAY_SECONDS") ?? 15),
  minSpans: Number(demoEnv.get("GREENLIGHT_MIN_SPANS") ?? 200),
};

/** Fails early rather than half way through a ten-minute run. */
export function requireConfiguration() {
  if (!config.token) {
    throw new Error("GREENLIGHT_ADMIN_TOKEN is missing from .workloads/greenlight.env");
  }
  if (!config.repository) {
    throw new Error("GITHUB_REPOSITORY is missing from .env.demo");
  }
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createLogger(scenario) {
  return (message) => console.log(`${scenario}: ${message}`);
}

export function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited ${code}`)),
    );
  });
}

/** Runs a command and returns its stdout, tolerating a non-zero exit. */
export function capture(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "inherit"],
      ...options,
    });
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.on("error", reject);
    child.on("exit", (code) => resolve({ code, stdout }));
  });
}

export async function api(path, init = {}) {
  const response = await fetch(`${config.apiBase}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
      ...init.headers,
    },
  });
  const body = await response.text();
  const payload = body ? JSON.parse(body) : undefined;
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} -> ${response.status} ${body}`);
  }
  return payload;
}

/**
 * Work is queued, so the HTTP 202 only means the request was accepted. A
 * scenario must not advance until the job itself has succeeded, otherwise a
 * later phase would build on a deployment that never actually recorded.
 */
export async function awaitJob(jobId, { timeoutMs = 180_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const job = await api(`/api/v1/jobs/${jobId}`);
    if (job.state === "succeeded") return job;
    if (job.state === "failed" || job.state === "dead") {
      throw new Error(`job ${jobId} ${job.state}: ${JSON.stringify(job.lastError ?? job)}`);
    }
    if (Date.now() > deadline) {
      throw new Error(`job ${jobId} still ${job.state} after ${timeoutMs}ms`);
    }
    await sleep(2_000);
  }
}

// The workload image is built locally, so it has no registry digest. Its
// content-addressed image ID identifies exactly what ran.
export function workloadImageDigest() {
  return process.env.BLNK_IMAGE_DIGEST ??
    execFileSync("docker", [
      "image", "inspect", "greenlight/blnk:v0.15.1", "--format", "{{.Id}}",
    ], { cwd: ROOT }).toString().trim();
}

/** Drives the workload's own compose project, for scenarios that fault it. */
export const workloadCompose = (...args) =>
  run("docker", [
    "compose",
    "--env-file", join(ROOT, ".workloads/blnk.env"),
    "-f", join(ROOT, "integrations/blnk/compose.yaml"),
    ...args,
  ]);

const blnkKey = readEnvFile(join(ROOT, ".workloads/blnk.env")).get("BLNK_DEMO_KEY");

/**
 * What a traffic run is allowed to conclude about its own output.
 *
 * A window that is meant to *describe* a version must not be judged by the
 * generator — deciding whether observed failures constitute a regression is the
 * evaluator's job. A window that exists to establish a precondition, or to
 * prove a fault was actually injected, must be checked here, because nothing
 * downstream can tell a missing fault from a healthy one.
 */
export const TrafficExpectation = {
  /** The run must complete cleanly, or the window cannot serve its purpose. */
  MustBeClean: "must-be-clean",
  /** Whatever happened is the measurement. The evaluator decides its meaning. */
  AsMeasured: "as-measured",
  /** The run must contain failures, or the injected fault did not take effect. */
  MustContainFailures: "must-contain-failures",
};

/** Generates traffic and returns what the run actually observed. */
export async function generateLoad({ requests, seconds, expect, log }) {
  const { code, stdout } = await capture("node", [
    "integrations/blnk/load.mjs",
    "--profile", "healthy",
    "--requests", String(requests),
    "--concurrency", "5",
    "--duration-seconds", String(seconds),
  ], { env: { ...process.env, BLNK_DEMO_KEY: blnkKey } });

  const line = stdout.trim().split("\n").filter(Boolean).at(-1);
  const counts = line ? JSON.parse(line) : null;
  if (!counts) throw new Error(`load generator produced no result (exit ${code})`);
  log(`load ${JSON.stringify(counts)}`);

  if (expect === TrafficExpectation.MustBeClean && code !== 0) {
    throw new Error(`window required clean traffic but reported failures: ${line}`);
  }
  if (expect === TrafficExpectation.MustContainFailures && counts.applicationErrors === 0) {
    throw new Error("the fault window recorded no failed requests, so nothing was injected");
  }
  return counts;
}

/**
 * Deploys a commit as an immutable workload version, records it, and fills the
 * window GreenLight will measure with traffic.
 *
 * `windowSeconds` differs between baseline and candidate/recovery because the
 * API derives them from different settings. `duringWindow`, when supplied, runs
 * concurrently with the traffic so a fault starts and ends inside the measured
 * window rather than around it.
 */
export async function deployPhase({
  commitSha,
  role,
  windowSeconds,
  scenario,
  log,
  duringWindow,
  expect = TrafficExpectation.AsMeasured,
}) {
  log(`${role}: deploying ${commitSha.slice(0, 12)}`);
  await run("bash", ["integrations/blnk/release.sh", commitSha]);

  // The deployment cannot be recorded until SigNoz has seen the new version,
  // so emit a short burst of traffic first and let it land.
  const deployedAt = new Date().toISOString();
  await generateLoad({
    requests: 40,
    seconds: 20,
    expect: TrafficExpectation.AsMeasured,
    log,
  });
  await sleep(10_000);

  log(`${role}: recording deployment`);
  const accepted = await api("/api/v1/deployments", {
    method: "POST",
    body: JSON.stringify({
      repository: config.repository,
      commitSha,
      serviceName: SERVICE_NAME,
      environmentName: ENVIRONMENT_NAME,
      route: ROUTE,
      healthUrl: HEALTH_URL,
      imageDigest: workloadImageDigest(),
      idempotencyKey: `${scenario}-${role}-${commitSha.slice(0, 12)}`,
      provider: scenario,
      role,
      status: "succeeded",
      deployedAt,
    }),
  });
  const job = await awaitJob(accepted.jobId);
  const deploymentId = job.result?.deploymentId;
  if (!deploymentId) {
    throw new Error(`deployment job returned no id: ${JSON.stringify(job.result)}`);
  }
  log(`${role}: deployment ${deploymentId} (version ${job.result.versionState})`);

  // The window opens one warmup after `readiness_at`, which the API stamps
  // while it is still waiting for the version to become visible in SigNoz.
  // Timing from "now" instead would start the clock after that wait, so part of
  // the window would already have elapsed unfilled and the sample could fall
  // below the evaluator's floor — reported as `insufficient_data`, which looks
  // like a measurement problem rather than the timing mistake it is.
  const readinessMs = Date.parse(job.result.readinessAt ?? "");
  if (!Number.isFinite(readinessMs)) {
    throw new Error(`deployment ${deploymentId} reported no readiness time`);
  }
  const windowOpensAtMs = readinessMs + config.warmupSeconds * 1_000;
  const windowClosesAtMs = windowOpensAtMs + windowSeconds * 1_000;
  const waitMs = windowOpensAtMs - Date.now();
  if (waitMs > 0) {
    log(`${role}: waiting ${Math.round(waitMs / 1_000)}s for the window to open`);
    await sleep(waitMs + 2_000);
  } else {
    log(`${role}: window opened ${Math.round(-waitMs / 1_000)}s ago; starting traffic now`);
  }

  const remainingMs = windowClosesAtMs - Date.now();
  if (remainingMs < windowSeconds * 500) {
    throw new Error(
      `${role}: less than half the ${windowSeconds}s window remains, so it cannot be filled. ` +
      "Recording the deployment took too long; retry against a warmer stack.",
    );
  }

  // Generate for whatever is genuinely left, stopping short of the close so the
  // last request still lands inside the window rather than just after it.
  const trafficSeconds = Math.floor(remainingMs / 1_000) - 8;
  log(`${role}: generating ${trafficSeconds}s of traffic inside the window`);
  const traffic = generateLoad({
    requests: Math.max(config.minSpans + 60, 260),
    seconds: trafficSeconds,
    expect,
    log,
  });
  if (duringWindow) await duringWindow();
  await traffic;

  log(`${role}: waiting for the window to close and telemetry to land`);
  const untilCloseMs = Math.max(0, windowClosesAtMs - Date.now());
  await sleep(untilCloseMs + config.ingestionSeconds * 1_000 + 15_000);
  return deploymentId;
}

/**
 * Returns the already-frozen baseline deployment for a commit, if there is one.
 *
 * A baseline can only be frozen once per service and environment, which is
 * correct: every later verdict is measured against one immutable snapshot, and
 * re-freezing it would silently move the yardstick. Rehearsals therefore have to
 * reuse it rather than recreate it.
 *
 * Read through the public receipt rather than a private query, so the scenario
 * sees exactly what a reader would.
 */
export async function findFrozenBaseline(commitSha) {
  let receipt;
  try {
    receipt = await api(`/api/v1/changes/${commitSha}`);
  } catch {
    return null;
  }
  const deployment = receipt?.deployment;
  return deployment?.role === "baseline" && deployment.status === "succeeded"
    ? deployment
    : null;
}

/**
 * Reuses the frozen baseline when it is the same commit, and refuses when it is
 * not: comparing a candidate against a baseline from a different commit than the
 * one asked for would quietly change what the verdict means.
 */
export async function ensureBaseline({ commitSha, windowSeconds, scenario, log }) {
  const existing = await findFrozenBaseline(commitSha);
  if (existing) {
    log(`baseline: reusing frozen deployment ${existing.id} for ${commitSha.slice(0, 12)}`);
    return existing.id;
  }

  const other = await api("/api/v1/changes")
    .then(({ changes }) => changes ?? [])
    .catch(() => []);
  for (const change of other) {
    if (change.commitSha === commitSha) continue;
    const deployment = await findFrozenBaseline(change.commitSha);
    if (deployment) {
      throw new Error(
        `a baseline is already frozen for ${change.shortSha}, not ${commitSha.slice(0, 7)}. ` +
        "Pass that commit as the baseline, or clear the stack before recording a new one.",
      );
    }
  }

  return deployPhase({
    commitSha,
    role: "baseline",
    windowSeconds,
    scenario,
    log,
    // A baseline is the yardstick every later verdict is measured against. If
    // this window is not clean the run must stop rather than freeze a degraded
    // baseline that would make a later regression look smaller.
    expect: TrafficExpectation.MustBeClean,
  });
}

export async function evaluate(body) {
  const accepted = await api("/api/v1/regressions/evaluate", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const job = await awaitJob(accepted.jobId);
  return job.result;
}

/** Prints a scenario failure without a stack trace and sets a failing exit. */
export function reportFailure(scenario, error) {
  console.error(`${scenario}: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}
