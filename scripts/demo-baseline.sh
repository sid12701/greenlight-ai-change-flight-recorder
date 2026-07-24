#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bash "${ROOT}/integrations/blnk/up.sh"

set -a
# shellcheck disable=SC1091
source "${ROOT}/.workloads/blnk.env"
set +a

echo "demo-baseline: generating healthy Blnk loan-ledger traffic"
node "${ROOT}/integrations/blnk/load.mjs" \
  --profile healthy \
  --requests "${GREENLIGHT_LOAD_TARGET:-250}" \
  --concurrency "${GREENLIGHT_LOAD_CONCURRENCY:-5}" \
  --duration-seconds "${GREENLIGHT_LOAD_SECONDS:-90}"
