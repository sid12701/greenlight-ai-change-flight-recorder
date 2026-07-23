#!/usr/bin/env bash
# Full regression/recovery rehearsal with timed SigNoz windows.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
set -a
source "${ROOT}/.env"
set +a

: "${LMS_PATH:?LMS_PATH is required}"
: "${GREENLIGHT_ADMIN_TOKEN:?GREENLIGHT_ADMIN_TOKEN is required}"
: "${BAD_SHA:?BAD_SHA is required}"

BASELINE_SHA="${BASELINE_SHA:-2269d064f0be50e7f6485c0be38e3cdcef6137d2}"
export OTEL_JAVA_AGENT_PATH="${OTEL_JAVA_AGENT_PATH:-${ROOT}/instrumentation/lms-java-agent/opentelemetry-javaagent.jar}"
export GREENLIGHT_LOAD_SECONDS=90
export GREENLIGHT_LOAD_TARGET=250

echo "=== Phase 1: baseline traffic (90s) ==="
LMS_PATH="$LMS_PATH" bash "${ROOT}/integrations/lms/deploy.sh" "$BASELINE_SHA" baseline
node "${ROOT}/integrations/lms/load-home-overview.mjs"

echo "=== Phase 2: wait 15s for window alignment ==="
sleep 15

echo "=== Phase 3: regression (bad deploy + load + evaluate) ==="
export BAD_SHA
bash "${ROOT}/scripts/demo-regression.sh" | tee /tmp/greenlight-regression.json

echo "=== Phase 4: recovery ==="
bash "${ROOT}/scripts/demo-recover.sh" | tee /tmp/greenlight-recovery.json

echo "=== Rehearsal complete ==="
