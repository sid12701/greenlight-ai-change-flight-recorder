#!/usr/bin/env node
/**
 * Records what GreenLight does when something the commit never touched fails
 * inside a measured window.
 *
 * This scenario **deliberately stops the workload's PostgreSQL dependency**
 * part way through the window, then asks for a verdict. The point is not to
 * blame the deployed version — it is to show that GreenLight reports what it
 * measured against the version that was running, states the association, and
 * refuses to assert that the commit caused it. An evidence tool that quietly
 * attributed an unrelated outage to whatever happened to be deployed would be
 * worse than no tool at all.
 *
 * It is kept out of `demo-chain.mjs` on purpose. A verdict is only evidence
 * about a change if nothing else was done to the service while it was being
 * measured, so the scenario that measures a change and the scenario that
 * injects a fault must never be the same run.
 *
 * Because a baseline can only be frozen once per service and environment, this
 * scenario captures its own baseline and is meant to be run on a stack that has
 * been reset (`bash scripts/demo-reset.sh`), not alongside a recorded chain.
 *
 *   node scripts/demo-dependency-failure.mjs <baseline-sha> <candidate-sha>
 */
import {
  ROUTE,
  TrafficExpectation,
  config,
  createLogger,
  deployPhase,
  ensureBaseline,
  evaluate,
  reportFailure,
  requireConfiguration,
  sleep,
  workloadCompose,
} from "./lib/demo-runtime.mjs";

const SCENARIO = "demo-dependency-failure";
const log = createLogger(SCENARIO);

/** How long into the window the outage starts, and how long it lasts. */
const OUTAGE_DELAY_MS = 20_000;
const OUTAGE_DURATION_MS = 30_000;

requireConfiguration();

/**
 * Stops and restarts the workload's database inside the measured window.
 *
 * Driven from here rather than from an external script so the outage is
 * guaranteed to begin and end inside the window GreenLight evaluates. Traffic
 * is already running, so the failures recorded are genuine 5xx responses from a
 * real dependency outage rather than synthesised spans.
 */
async function stopDatabaseInsideWindow() {
  await sleep(OUTAGE_DELAY_MS);
  log("stopping the workload's PostgreSQL dependency");
  await workloadCompose("stop", "postgres");
  await sleep(OUTAGE_DURATION_MS);
  log("restoring PostgreSQL");
  await workloadCompose("start", "postgres");
}

async function main() {
  const [baselineSha, candidateSha] = process.argv.slice(2);
  if (!baselineSha || !candidateSha) {
    throw new Error(
      "usage: demo-dependency-failure.mjs <baseline-sha> <candidate-sha>",
    );
  }

  log("this scenario injects a real dependency outage; it does not measure a code change");

  const baselineId = await ensureBaseline({
    commitSha: baselineSha,
    windowSeconds: config.baselineSeconds,
    scenario: SCENARIO,
    log,
  });

  const candidateId = await deployPhase({
    commitSha: candidateSha,
    role: "candidate",
    windowSeconds: config.observedSeconds,
    scenario: SCENARIO,
    log,
    duringWindow: stopDatabaseInsideWindow,
    // If the window recorded no failures the outage never took effect, and the
    // scenario proved nothing. That has to fail loudly rather than pass as a
    // healthy verdict.
    expect: TrafficExpectation.MustContainFailures,
  });

  log("evaluating the candidate window that contains the outage");
  const verdict = await evaluate({
    deploymentId: candidateId,
    baselineDeploymentId: baselineId,
    route: ROUTE,
  });
  log(`verdict: ${verdict?.status}`);

  console.log(JSON.stringify({
    scenario: SCENARIO,
    faultsInjected: [
      {
        kind: "dependency_outage",
        target: "workload postgres",
        startedAfterMs: OUTAGE_DELAY_MS,
        durationMs: OUTAGE_DURATION_MS,
      },
    ],
    demonstrates:
      "GreenLight reports the failures it measured against the deployed version " +
      "and states the association without asserting the commit caused them.",
    baseline: { commitSha: baselineSha, deploymentId: baselineId },
    candidate: {
      commitSha: candidateSha,
      deploymentId: candidateId,
      verdict: verdict?.status,
    },
  }, null, 2));
}

main().catch((error) => reportFailure(SCENARIO, error));
