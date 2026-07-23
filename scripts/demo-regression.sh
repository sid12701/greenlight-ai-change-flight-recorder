#!/usr/bin/env bash
# Apply regression patch, deploy candidate, load, evaluate — GL-P6-T01
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
source "${ROOT}/.env" 2>/dev/null || true

: "${LMS_PATH:?LMS_PATH is required}"
: "${GREENLIGHT_ADMIN_TOKEN:?GREENLIGHT_ADMIN_TOKEN is required}"

BAD_SHA="${BAD_SHA:-}"
if [[ -z "$BAD_SHA" ]]; then
  echo "demo-regression: apply regression.patch in the LMS demo clone, commit, and set BAD_SHA" >&2
  exit 1
fi

echo "demo-regression: deploying candidate ${BAD_SHA}"
LMS_PATH="$LMS_PATH" bash "${ROOT}/integrations/lms/deploy.sh" "$BAD_SHA"

curl -fsS -X POST "http://127.0.0.1:4000/api/v1/deployments" \
  -H "Authorization: Bearer ${GREENLIGHT_ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"repository\":\"${GITHUB_REPOSITORY:-demo/lms}\",\"commitSha\":\"${BAD_SHA}\",\"serviceName\":\"lms-backend\",\"environmentName\":\"hackathon-demo\",\"role\":\"candidate\",\"status\":\"succeeded\",\"deployedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"

echo "demo-regression: generating load"
node "${ROOT}/integrations/lms/load-home-overview.mjs" --requests 250

DEPLOYMENT_ID="$(sqlite3 "${GREENLIGHT_DATABASE_PATH:-${ROOT}/data/greenlight.db}" \
  "SELECT id FROM deployments WHERE role='candidate' ORDER BY deployed_at DESC LIMIT 1")"

curl -fsS -X POST "http://127.0.0.1:4000/api/v1/regressions/evaluate" \
  -H "Authorization: Bearer ${GREENLIGHT_ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"deploymentId\":\"${DEPLOYMENT_ID}\",\"route\":\"/api/v1/internal/home/overview\"}"

echo "demo-regression: complete"
