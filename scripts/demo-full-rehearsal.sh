#!/usr/bin/env bash
# Full rehearsal: reset transient state, then record one complete evidence chain.
#
# The phase-by-phase scripts this used to call only generated traffic; they
# recorded no deployment and asked for no verdict, so a "rehearsal" could pass
# while producing nothing a receipt could be built from. The chain scenario does
# the whole thing and fails if any step does not hold.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

BASELINE_SHA="${1:-${BASELINE_SHA:-}}"
CANDIDATE_SHA="${2:-${CANDIDATE_SHA:-}}"
RECOVERY_SHA="${3:-${RECOVERY_SHA:-}}"

if [[ -z "${BASELINE_SHA}" || -z "${CANDIDATE_SHA}" ]]; then
  cat >&2 <<'USAGE'
usage: demo-full-rehearsal.sh <baseline-sha> <candidate-sha> [recovery-sha]
   or: BASELINE_SHA=… CANDIDATE_SHA=… [RECOVERY_SHA=…] npm run demo:rehearse

Every phase deploys a real commit as an immutable workload version, so the SHAs
must exist in GITHUB_REPOSITORY.
USAGE
  exit 1
fi

echo "=== Preflight: the stack must be healthy before anything is recorded ==="
bash "${ROOT}/scripts/demo-bootstrap.sh" --status

echo "=== Reset: clear the previous candidate and recovery, keep the baseline ==="
bash "${ROOT}/scripts/demo-reset.sh"

echo "=== Record: baseline, candidate, recovery with real measurement windows ==="
node "${ROOT}/scripts/demo-chain.mjs" \
  "${BASELINE_SHA}" "${CANDIDATE_SHA}" ${RECOVERY_SHA:+"${RECOVERY_SHA}"}

echo "=== Verify: every link a receipt publishes must open ==="
node "${ROOT}/scripts/verify-receipt-links.mjs"

echo "=== Rehearsal complete ==="
