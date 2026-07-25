#!/usr/bin/env bash
# Soft reset: clear candidate and recovery state, keep the frozen baseline.
#
# Runs against the PostgreSQL the demo actually uses. An earlier version drove
# sqlite3 against GREENLIGHT_DATABASE_PATH, which the containerised demo never
# writes: it printed "no such table" for every statement and still exited 0, so a
# rehearsal that believed it had reset carried the previous run's candidate
# forward. A reset that cannot reset has to fail loudly.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER="${GREENLIGHT_POSTGRES_CONTAINER:-greenlight-postgres-1}"
DB_NAME="${GREENLIGHT_POSTGRES_DB:-greenlight}"
DB_USER="${GREENLIGHT_POSTGRES_USER:-greenlight}"

if [[ "$#" -ne 0 ]]; then
  echo "demo-reset: only the documented soft reset is supported; unexpected argument '$1'" >&2
  exit 1
fi

if ! docker inspect --format '{{.State.Running}}' "${CONTAINER}" 2>/dev/null | grep -q true; then
  echo "demo-reset: ${CONTAINER} is not running; start the stack with: npm run demo:up" >&2
  exit 1
fi

# `ON_ERROR_STOP` plus a single transaction means a partial reset is impossible:
# either every transient row goes, or nothing does and the exit code says so.
docker exec -i "${CONTAINER}" psql \
  -v ON_ERROR_STOP=1 \
  --quiet \
  -U "${DB_USER}" \
  -d "${DB_NAME}" <<'SQL'
BEGIN;

CREATE TEMPORARY TABLE transient_deployments AS
  SELECT id FROM deployments WHERE role IN ('candidate', 'recovery');

DELETE FROM evidence_links WHERE regression_evaluation_id IN (
  SELECT id FROM regression_evaluations
  WHERE deployment_id IN (SELECT id FROM transient_deployments)
);
DELETE FROM regression_evaluations
  WHERE deployment_id IN (SELECT id FROM transient_deployments);
DELETE FROM regression_incidents
  WHERE candidate_deployment_id IN (SELECT id FROM transient_deployments)
     OR recovery_deployment_id IN (SELECT id FROM transient_deployments);
DELETE FROM evaluation_windows
  WHERE deployment_id IN (SELECT id FROM transient_deployments);
DELETE FROM deployments WHERE id IN (SELECT id FROM transient_deployments);

COMMIT;

-- What survived, so an operator can see the baseline was preserved rather than
-- taking the word "soft" on trust.
SELECT role, count(*) AS deployments FROM deployments GROUP BY role ORDER BY role;
SELECT count(*) AS frozen_baseline_snapshots FROM baseline_snapshots;
SQL

echo "demo-reset: soft reset complete (baseline deployments and immutable evidence preserved)"
echo "demo-reset: SigNoz telemetry is untouched; only GreenLight's transient rows were cleared"
