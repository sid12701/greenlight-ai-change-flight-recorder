#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
source "${ROOT}/.env" 2>/dev/null || true

: "${GREENLIGHT_ADMIN_TOKEN:?GREENLIGHT_ADMIN_TOKEN is required}"
: "${BAD_SHA:?BAD_SHA is required}"
: "${LMS_CANDIDATE_IMAGE:?LMS_CANDIDATE_IMAGE must be pinned by digest}"

echo "demo-regression: deploying immutable candidate ${BAD_SHA}"
DEPLOY_RESULT="$(
  LMS_IMAGE="$LMS_CANDIDATE_IMAGE" \
  LMS_DEPLOYMENT_SLOT=green \
  LMS_BACKEND_PORT="${LMS_CANDIDATE_PORT:-8082}" \
  bash "${ROOT}/integrations/lms/deploy.sh" "$BAD_SHA" candidate |
  tail -n 1
)"
DEPLOYMENT_ID="$(node -e 'const value=JSON.parse(process.argv[1]);process.stdout.write(value.deploymentId)' "$DEPLOY_RESULT")"

echo "demo-regression: generating controlled load"
LMS_BASE_URL="${LMS_CANDIDATE_URL:-http://127.0.0.1:${LMS_CANDIDATE_PORT:-8082}}" \
  node "${ROOT}/integrations/lms/load-home-overview.mjs" --requests 250

JOB_RESPONSE="$(curl --fail --silent --show-error \
  --request POST "${GREENLIGHT_API_URL:-http://127.0.0.1:4000}/api/v1/regressions/evaluate" \
  --header "Authorization: Bearer ${GREENLIGHT_ADMIN_TOKEN}" \
  --header "Content-Type: application/json" \
  --data "$(printf '{"deploymentId":"%s","route":"%s"}' \
    "$DEPLOYMENT_ID" "${LMS_DEMO_ROUTE:-/api/v1/internal/home/overview}")")"
JOB_ID="$(node -e 'const value=JSON.parse(process.argv[1]);process.stdout.write(value.jobId)' "$JOB_RESPONSE")"
RESULT="$(node "${ROOT}/scripts/wait-job.mjs" "$JOB_ID")"
printf '%s\n' "$RESULT" >"${GREENLIGHT_REGRESSION_RESULT_PATH:-/tmp/greenlight-regression-result.json}"
printf '%s\n' "$RESULT"
