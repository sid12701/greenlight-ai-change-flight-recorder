#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
source "${ROOT}/.env" 2>/dev/null || true

: "${LMS_PATH:?LMS_PATH is required}"
: "${GREENLIGHT_ADMIN_TOKEN:?GREENLIGHT_ADMIN_TOKEN is required}"

BASELINE_SHA="${BASELINE_SHA:-2269d064f0be50e7f6485c0be38e3cdcef6137d2}"

echo "demo-baseline: recording baseline deployment for ${BASELINE_SHA}"
curl -fsS -X POST "http://127.0.0.1:4000/api/v1/deployments" \
  -H "Authorization: Bearer ${GREENLIGHT_ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"repository\":\"${GITHUB_REPOSITORY:-demo/lms}\",\"commitSha\":\"${BASELINE_SHA}\",\"serviceName\":\"lms-backend\",\"environmentName\":\"hackathon-demo\",\"role\":\"baseline\",\"status\":\"succeeded\",\"deployedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"

echo "demo-baseline: generating load"
node "${ROOT}/integrations/lms/load-home-overview.mjs"
