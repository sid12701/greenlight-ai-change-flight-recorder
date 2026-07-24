#!/usr/bin/env bash
# Full regression/recovery rehearsal with timed SigNoz windows.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
set -a
source "${ROOT}/.env"
set +a

: "${GREENLIGHT_ADMIN_TOKEN:?GREENLIGHT_ADMIN_TOKEN is required}"
: "${BAD_SHA:?BAD_SHA is required}"
: "${LMS_BASELINE_SHA:?LMS_BASELINE_SHA is required}"
: "${RECOVERY_SHA:?RECOVERY_SHA is required}"

export GREENLIGHT_LOAD_SECONDS=90
export GREENLIGHT_LOAD_TARGET=250

echo "=== Phase 1: baseline traffic (90s) ==="
bash "${ROOT}/scripts/demo-baseline.sh"

echo "=== Phase 2: regression (bad deploy + load + evaluate) ==="
export BAD_SHA
bash "${ROOT}/scripts/demo-regression.sh"
INCIDENT_ID="$(node -e 'const value=require(process.argv[1]);process.stdout.write(value.incidentId)' \
  "${GREENLIGHT_REGRESSION_RESULT_PATH:-/tmp/greenlight-regression-result.json}")"
export INCIDENT_ID

echo "=== Phase 3: recovery ==="
bash "${ROOT}/scripts/demo-recover.sh"

echo "=== Rehearsal complete ==="
