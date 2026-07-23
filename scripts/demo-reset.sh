#!/usr/bin/env bash
# Soft reset candidate/recovery state only — GL-P6-T03
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
source "${ROOT}/.env" 2>/dev/null || true

DB_PATH="${GREENLIGHT_DATABASE_PATH:-${ROOT}/data/greenlight.db}"
HARD=0
if [[ "${1:-}" == "--hard" ]]; then
  if [[ "${GREENLIGHT_DEMO_HARD_RESET_PHRASE:-}" != "RESET-GREENLIGHT-DEMO" ]]; then
    echo "demo-reset: refusing --hard without GREENLIGHT_DEMO_HARD_RESET_PHRASE=RESET-GREENLIGHT-DEMO" >&2
    exit 1
  fi
  HARD=1
fi

if [[ ! -f "$DB_PATH" ]]; then
  echo "demo-reset: database not found at $DB_PATH" >&2
  exit 1
fi

if [[ "$DB_PATH" != *"greenlight"* ]]; then
  echo "demo-reset: refusing non-demo database path: $DB_PATH" >&2
  exit 1
fi

if [[ "$HARD" == "1" ]]; then
  echo "demo-reset: hard reset is destructive and not used during rehearsals"
  exit 1
fi

sqlite3 "$DB_PATH" <<'SQL'
DELETE FROM evidence_links WHERE regression_evaluation_id IN (
  SELECT id FROM regression_evaluations WHERE comparison_kind IN ('deployment', 'recovery')
    AND deployment_id IN (SELECT id FROM deployments WHERE role IN ('candidate', 'recovery'))
);
DELETE FROM regression_evaluations WHERE deployment_id IN (
  SELECT id FROM deployments WHERE role IN ('candidate', 'recovery')
);
DELETE FROM deployments WHERE role IN ('candidate', 'recovery');
SQL

echo "demo-reset: soft reset complete (baseline deployments and immutable evidence preserved)"
