#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
source "${ROOT}/.env" 2>/dev/null || true

: "${GREENLIGHT_ADMIN_TOKEN:?GREENLIGHT_ADMIN_TOKEN is required}"
: "${LMS_BASELINE_SHA:?LMS_BASELINE_SHA is required}"
: "${LMS_BASELINE_IMAGE:?LMS_BASELINE_IMAGE must be pinned by digest}"

echo "demo-baseline: deploying immutable baseline ${LMS_BASELINE_SHA}"
DEPLOY_RESULT="$(
  LMS_IMAGE="$LMS_BASELINE_IMAGE" \
  LMS_DEPLOYMENT_SLOT=blue \
  LMS_BACKEND_PORT="${LMS_BASELINE_PORT:-8081}" \
  bash "${ROOT}/integrations/lms/deploy.sh" "$LMS_BASELINE_SHA" baseline |
  tail -n 1
)"
echo "$DEPLOY_RESULT"

echo "demo-baseline: generating load"
LMS_BASE_URL="${LMS_BASELINE_URL:-http://127.0.0.1:${LMS_BASELINE_PORT:-8081}}" \
  node "${ROOT}/integrations/lms/load-home-overview.mjs" --requests 250
