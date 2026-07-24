#!/usr/bin/env bash
# Soft reset candidate/recovery state only — GL-P6-T03
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
source "${ROOT}/.env" 2>/dev/null || true

DB_PATH="${GREENLIGHT_DATABASE_PATH:-${ROOT}/data/greenlight.db}"
if [[ "$#" -ne 0 ]]; then
  echo "demo-reset: only the documented soft reset is supported; unexpected argument '$1'" >&2
  exit 1
fi

if [[ ! -f "$DB_PATH" ]]; then
  echo "demo-reset: database not found at $DB_PATH" >&2
  exit 1
fi

if [[ "$DB_PATH" != *"greenlight"* ]]; then
  echo "demo-reset: refusing non-demo database path: $DB_PATH" >&2
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
DELETE FROM regression_incidents WHERE candidate_deployment_id IN (
  SELECT id FROM deployments WHERE role = 'candidate'
) OR recovery_deployment_id IN (
  SELECT id FROM deployments WHERE role = 'recovery'
);
DELETE FROM evaluation_windows WHERE deployment_id IN (
  SELECT id FROM deployments WHERE role IN ('candidate', 'recovery')
);
DELETE FROM deployments WHERE role IN ('candidate', 'recovery');
SQL

echo "demo-reset: soft reset complete (baseline deployments and immutable evidence preserved)"
