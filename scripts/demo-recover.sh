#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
source "${ROOT}/.env" 2>/dev/null || true

: "${GREENLIGHT_ADMIN_TOKEN:?GREENLIGHT_ADMIN_TOKEN is required}"
: "${RECOVERY_SHA:?RECOVERY_SHA is required}"
: "${LMS_RECOVERY_IMAGE:?LMS_RECOVERY_IMAGE must be pinned by digest}"
: "${INCIDENT_ID:?INCIDENT_ID from the candidate evaluation is required}"

echo "demo-recover: deploying immutable recovery ${RECOVERY_SHA}"
DEPLOY_RESULT="$(
  LMS_IMAGE="$LMS_RECOVERY_IMAGE" \
  LMS_DEPLOYMENT_SLOT=blue \
  LMS_BACKEND_PORT="${LMS_RECOVERY_PORT:-8081}" \
  bash "${ROOT}/integrations/lms/deploy.sh" "$RECOVERY_SHA" recovery |
  tail -n 1
)"
DEPLOYMENT_ID="$(node -e 'const value=JSON.parse(process.argv[1]);process.stdout.write(value.deploymentId)' "$DEPLOY_RESULT")"

LMS_BASE_URL="${LMS_RECOVERY_URL:-http://127.0.0.1:${LMS_RECOVERY_PORT:-8081}}" \
  node "${ROOT}/integrations/lms/load-home-overview.mjs" --requests 250

JOB_RESPONSE="$(curl --fail --silent --show-error \
  --request POST "${GREENLIGHT_API_URL:-http://127.0.0.1:4000}/api/v1/regressions/evaluate" \
  --header "Authorization: Bearer ${GREENLIGHT_ADMIN_TOKEN}" \
  --header "Content-Type: application/json" \
  --data "$(printf '{"deploymentId":"%s","incidentId":"%s","route":"%s","comparisonKind":"recovery"}' \
    "$DEPLOYMENT_ID" "$INCIDENT_ID" "${LMS_DEMO_ROUTE:-/api/v1/internal/home/overview}")")"
JOB_ID="$(node -e 'const value=JSON.parse(process.argv[1]);process.stdout.write(value.jobId)' "$JOB_RESPONSE")"
node "${ROOT}/scripts/wait-job.mjs" "$JOB_ID"
