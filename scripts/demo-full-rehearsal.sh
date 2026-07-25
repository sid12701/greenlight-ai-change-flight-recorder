#!/usr/bin/env bash
# Full regression/recovery rehearsal with timed SigNoz windows.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
set -a
source "${ROOT}/.env" 2>/dev/null || true
set +a

export GREENLIGHT_LOAD_SECONDS=90
export GREENLIGHT_LOAD_TARGET=250

echo "=== Phase 1: baseline traffic (90s) ==="
bash "${ROOT}/scripts/demo-baseline.sh"

echo "=== Phase 2: real dependency outage and automatic safety recovery ==="
bash "${ROOT}/scripts/demo-regression.sh"

echo "=== Phase 3: sustained recovery traffic ==="
bash "${ROOT}/scripts/demo-recover.sh"

echo "=== Rehearsal complete ==="
