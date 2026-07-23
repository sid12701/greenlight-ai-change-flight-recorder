#!/usr/bin/env bash
# Deploy recovery build and evaluate against frozen baseline — GL-P6-T02
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
source "${ROOT}/.env" 2>/dev/null || true

: "${LMS_PATH:?LMS_PATH is required}"
: "${GREENLIGHT_ADMIN_TOKEN:?GREENLIGHT_ADMIN_TOKEN is required}"

RECOVERY_SHA="${RECOVERY_SHA:-${BASELINE_SHA:-2269d064f0be50e7f6485c0be38e3cdcef6137d2}}"

echo "demo-recover: deploying recovery ${RECOVERY_SHA}"
LMS_PATH="$LMS_PATH" bash "${ROOT}/integrations/lms/deploy.sh" "$RECOVERY_SHA"

curl -fsS -X POST "http://127.0.0.1:4000/api/v1/deployments" \
  -H "Authorization: Bearer ${GREENLIGHT_ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"repository\":\"${GITHUB_REPOSITORY:-demo/lms}\",\"commitSha\":\"${RECOVERY_SHA}\",\"serviceName\":\"lms-backend\",\"environmentName\":\"hackathon-demo\",\"role\":\"recovery\",\"status\":\"succeeded\",\"deployedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"

node "${ROOT}/integrations/lms/load-home-overview.mjs" --requests 250

DEPLOYMENT_ID="$(sqlite3 "${GREENLIGHT_DATABASE_PATH:-${ROOT}/data/greenlight.db}" \
  "SELECT id FROM deployments WHERE role='recovery' ORDER BY deployed_at DESC LIMIT 1")"

curl -fsS -X POST "http://127.0.0.1:4000/api/v1/regressions/evaluate" \
  -H "Authorization: Bearer ${GREENLIGHT_ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"deploymentId\":\"${DEPLOYMENT_ID}\",\"route\":\"/api/v1/internal/home/overview\",\"comparisonKind\":\"recovery\"}"

echo "demo-recover: complete"
