#!/usr/bin/env node
/**
 * Records one baseline → candidate → recovery evidence chain for a real commit.
 *
 * This scenario measures **what the deployed version did**, and nothing else.
 * It injects no faults, stops no dependencies, and asserts nothing about the
 * candidate's traffic: whatever the version produced is the measurement, and
 * deciding what that means is the evaluator's job, not this script's. The only
 * window held to a standard is the baseline, because a baseline captured from a
 * failing service would poison every later comparison.
 *
 * For the separate question of how GreenLight behaves when something the commit
 * never touched fails inside a measured window, see
 * `demo-dependency-failure.mjs`. Keeping the two apart is the point: a verdict
 * is only evidence about a change if nothing else was done to the service while
 * it was being measured.
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
} from "./lib/demo-runtime.mjs";

const SCENARIO = "demo-chain";
const log = createLogger(SCENARIO);

requireConfiguration();

async function runRecovery(recoverySha, incidentId) {
  const recoveryId = await deployPhase({
    commitSha: recoverySha,
    role: "recovery",
    windowSeconds: config.observedSeconds,
    scenario: SCENARIO,
    log,
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

  // The recovery commit is optional so the chain can be rehearsed as far as the
  // regression verdict before a fix exists.
  const [baselineSha, candidateSha, recoverySha] = args;
  if (!baselineSha || !candidateSha) {
    throw new Error("usage: demo-chain.mjs <baseline-sha> <candidate-sha> [recovery-sha]");
  }

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
    // Measured, not judged. If this version is slower, or errors, that is the
    // finding — the script must not decide in advance which it expects.
    expect: TrafficExpectation.AsMeasured,
  });

  log("evaluating the candidate against the frozen baseline");
  const candidateVerdict = await evaluate({
    deploymentId: candidateId,
    baselineDeploymentId: baselineId,
    route: ROUTE,
  });
  log(`candidate verdict: ${candidateVerdict?.status}`);

  const summary = {
    scenario: SCENARIO,
    faultsInjected: [],
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

main().catch((error) => reportFailure(SCENARIO, error));
