-- Paired with the SQLite migration of the same name; see it for why a baseline
-- can now be retired rather than only frozen.
--
-- Both dialects support a partial unique index, so the invariant is expressed
-- identically: at most one *active* baseline per service and environment, with
-- retired ones kept so the evaluations that cite them stay explainable.
ALTER TABLE deployments ADD COLUMN superseded_at TEXT;

DROP INDEX IF EXISTS idx_deployments_demo_baseline;

CREATE UNIQUE INDEX IF NOT EXISTS idx_deployments_active_baseline
  ON deployments(service_name, environment_name)
  WHERE role = 'baseline' AND status = 'succeeded' AND superseded_at IS NULL;
