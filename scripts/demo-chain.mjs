#!/usr/bin/env node
/**
 * Drives one complete baseline → regression → recovery evidence chain against
 * the running stack.
 *
 * Each phase deploys a real commit as an immutable workload version, generates
 * traffic inside the window GreenLight will actually measure, records the
 * deployment, and then asks GreenLight for a verdict. Nothing here fabricates
 * telemetry: the versions come from Git, the CI runs come from GitHub, and the
 * metrics come from whatever SigNoz observed.
 *
 * The timing is dictated by the API, not chosen here. A deployment's window
 * opens GREENLIGHT_WARMUP_SECONDS after it is recorded, runs for
 * GREENLIGHT_OBSERVED_WINDOW_SECONDS, and cannot be evaluated until a further
 * GREENLIGHT_INGESTION_DELAY_SECONDS has passed, so traffic is generated
 * inside that window and evaluation waits for it to close.
 */
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SERVICE_NAME = "blnk-loan-workload";
const ENVIRONMENT_NAME = "hackathon-demo";
const ROUTE = "/balances";
// The API performs this check itself, and it runs in a container, so the
// workload has to be named the way that container reaches the host.
const HEALTH_URL = process.env.BLNK_HEALTH_URL ??
  "http://host.docker.internal:18081/health";

function readEnvFile(path) {
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

const config = {
  apiBase: process.env.GREENLIGHT_API_BASE ?? "http://127.0.0.1:4000",
  token: localEnv.get("GREENLIGHT_ADMIN_TOKEN") ?? "",
  repository: demoEnv.get("GITHUB_REPOSITORY") ?? "",
  warmupSeconds: Number(demoEnv.get("GREENLIGHT_WARMUP_SECONDS") ?? 15),
  observedSeconds: Number(demoEnv.get("GREENLIGHT_OBSERVED_WINDOW_SECONDS") ?? 90),
  baselineSeconds: Number(demoEnv.get("GREENLIGHT_BASELINE_WINDOW_SECONDS") ?? 90),
  ingestionSeconds: Number(demoEnv.get("GREENLIGHT_INGESTION_DELAY_SECONDS") ?? 15),
  minSpans: Number(demoEnv.get("GREENLIGHT_MIN_SPANS") ?? 200),
};

if (!config.token) throw new Error("GREENLIGHT_ADMIN_TOKEN is missing from .workloads/greenlight.env");
if (!config.repository) throw new Error("GITHUB_REPOSITORY is missing from .env.demo");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (message) => console.log(`demo-chain: ${message}`);

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited ${code}`)),
    );
  });
}

/** Runs a command and returns its stdout, tolerating a non-zero exit. */
function capture(command, args, options = {}) {
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

async function api(path, init = {}) {
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
 * Work is queued, so the HTTP 202 only means the request was accepted. The
 * chain must not advance until the job itself has succeeded, otherwise a later
 * phase would build on a deployment that never actually recorded.
 */
async function awaitJob(jobId, { timeoutMs = 180_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const job = await api(`/api/v1/jobs/${jobId}`);
    if (job.state === "succeeded") return job;
    if (job.state === "failed" || job.state === "dead") {
      throw new Error(`job ${jobId} ${job.state}: ${JSON.stringify(job.lastError ?? job)}`);
    }
    if (Date.now() > deadline) throw new Error(`job ${jobId} still ${job.state} after ${timeoutMs}ms`);
    await sleep(2_000);
  }
}

// The workload image is built locally, so it has no registry digest. Its
// content-addressed image ID identifies exactly what ran.
const imageDigest = process.env.BLNK_IMAGE_DIGEST ??
  execFileSync("docker", [
    "image", "inspect", "greenlight/blnk:v0.15.1", "--format", "{{.Id}}",
  ], { cwd: ROOT }).toString().trim();

const compose = (...args) =>
  run("docker", [
    "compose",
    "--env-file", join(ROOT, ".workloads/blnk.env"),
    "-f", join(ROOT, "integrations/blnk/compose.yaml"),
    ...args,
  ]);

const blnkKey = readEnvFile(join(ROOT, ".workloads/blnk.env")).get("BLNK_DEMO_KEY");

/**
 * Generates traffic and returns what the run actually observed.
 *
 * `expect: "mixed"` is used for the window that contains a dependency outage,
 * where errors are the point. The counts are asserted rather than the exit
 * code, so a window that was supposed to fail but did not is still caught.
 */
async function generateLoad({ requests, seconds, expect = "healthy" }) {
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
  console.log(`demo-chain: load ${JSON.stringify(counts)}`);

  if (expect === "healthy" && code !== 0) {
    throw new Error(`healthy load reported failures: ${line}`);
  }
  if (expect === "mixed" && counts.applicationErrors === 0) {
    throw new Error("the outage window recorded no failed requests");
  }
  return counts;
}

/**
 * Deploys a commit and records it, then fills the measurement window with
 * traffic. `windowSeconds` differs between baseline and candidate/recovery
 * because the API derives them from different settings.
 */
async function deployPhase({ commitSha, role, windowSeconds, duringWindow, expect = "healthy" }) {
  log(`${role}: deploying ${commitSha.slice(0, 12)}`);
  await run("bash", ["integrations/blnk/release.sh", commitSha]);

  // The deployment cannot be recorded until SigNoz has seen the new version,
  // so emit a short burst of traffic first and let it land.
  const deployedAt = new Date().toISOString();
  await generateLoad({ requests: 40, seconds: 20 });
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
      imageDigest,
      idempotencyKey: `chain-${role}-${commitSha.slice(0, 12)}`,
      provider: "demo-chain",
      role,
      status: "succeeded",
      deployedAt,
    }),
  });
  const job = await awaitJob(accepted.jobId);
  const deploymentId = job.result?.deploymentId;
  if (!deploymentId) throw new Error(`deployment job returned no id: ${JSON.stringify(job.result)}`);
  log(`${role}: deployment ${deploymentId} (version ${job.result.versionState})`);

  // readiness_at is set when the deployment is recorded, and the window opens
  // one warmup after that.
  log(`${role}: waiting ${config.warmupSeconds}s for the window to open`);
  await sleep(config.warmupSeconds * 1_000 + 2_000);

  log(`${role}: generating ${windowSeconds}s of traffic inside the window`);
  const traffic = generateLoad({
    requests: Math.max(config.minSpans + 60, 260),
    seconds: windowSeconds - 10,
    expect,
  });
  if (duringWindow) await duringWindow();
  await traffic;

  log(`${role}: waiting for the window to close and telemetry to land`);
  await sleep(config.ingestionSeconds * 1_000 + 15_000);
  return deploymentId;
}

async function evaluate(body) {
  const accepted = await api("/api/v1/regressions/evaluate", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const job = await awaitJob(accepted.jobId);
  return job.result;
}

async function runRecovery(recoverySha, incidentId) {
  const recoveryId = await deployPhase({
    commitSha: recoverySha,
    role: "recovery",
    windowSeconds: config.observedSeconds,
  });

  log("evaluating the recovery against the same incident");
  const verdict = await evaluate({
    deploymentId: recoveryId,
    incidentId,
    route: ROUTE,
    comparisonKind: "recovery",
  });
  log(`recovery verdict: ${verdict?.status}`);
  return { commitSha: recoverySha, deploymentId: recoveryId, verdict: verdict?.status };
}

async function main() {
  const args = process.argv.slice(2);

  // A baseline can only be frozen once, so re-running the whole chain after a
  // transient failure in a later phase is not possible. Resuming the recovery
  // against the already-open incident is.
  if (args[0] === "--resume-recovery") {
    const [, recoverySha, incidentId] = args;
    if (!recoverySha || !incidentId) {
      throw new Error("usage: demo-chain.mjs --resume-recovery <recovery-sha> <incident-id>");
    }
    console.log(JSON.stringify(await runRecovery(recoverySha, incidentId), null, 2));
    return;
  }

  // The recovery commit is optional so the chain can be rehearsed as far as
  // the regression verdict before a fix exists.
  const [baselineSha, candidateSha, recoverySha] = args;
  if (!baselineSha || !candidateSha) {
    throw new Error("usage: demo-chain.mjs <baseline-sha> <candidate-sha> [recovery-sha]");
  }

  const baselineId = await deployPhase({
    commitSha: baselineSha,
    role: "baseline",
    windowSeconds: config.baselineSeconds,
  });

  const candidateId = await deployPhase({
    commitSha: candidateSha,
    role: "candidate",
    windowSeconds: config.observedSeconds,
    expect: "mixed",
    // A real dependency failure inside the candidate's measured window, driven
    // here rather than by failure-cycle.sh so that it starts and ends inside
    // the window GreenLight measures. The traffic generator is already running
    // and records genuine 5xx responses for the duration.
    //
    // GreenLight reports the correlation between the deployed version and the
    // failures. It does not claim the commit caused them, and the receipt says
    // so explicitly.
    duringWindow: async () => {
      await sleep(20_000);
      log("candidate: stopping the workload's PostgreSQL dependency");
      await compose("stop", "postgres");
      await sleep(30_000);
      log("candidate: restoring PostgreSQL");
      await compose("start", "postgres");
    },
  });

  log("evaluating the candidate against the frozen baseline");
  const candidateVerdict = await evaluate({
    deploymentId: candidateId,
    baselineDeploymentId: baselineId,
    route: ROUTE,
  });
  log(`candidate verdict: ${candidateVerdict?.status}`);

  const summary = {
    baseline: { commitSha: baselineSha, deploymentId: baselineId },
    candidate: {
      commitSha: candidateSha,
      deploymentId: candidateId,
      verdict: candidateVerdict?.status,
    },
  };

  if (recoverySha) {
    summary.recovery = await runRecovery(recoverySha, candidateVerdict?.incidentId);
  } else {
    log("no recovery commit supplied; stopping after the regression verdict");
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(`demo-chain: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
