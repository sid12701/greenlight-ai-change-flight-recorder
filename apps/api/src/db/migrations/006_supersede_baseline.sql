-- A baseline could be frozen exactly once, forever.
--
-- Freezing is right: every later verdict is measured against that snapshot, so
-- it must not drift underneath the evaluations that cite it. Permanence is not.
-- When a service legitimately changes performance — new instance size, a major
-- release — every subsequent comparison was against a stale baseline, and the
-- only way out was hand-written SQL, because both the service guard and this
-- unique index refused a second one.
--
-- Superseding separates the two ideas. A retired baseline keeps its row and its
-- snapshot, so an evaluation that cites it stays explainable with the baseline
-- it was actually measured against, while new comparisons resolve the active
-- one. The uniqueness guarantee is not weakened, only made precise: at most one
-- *active* baseline per service and environment.
ALTER TABLE deployments ADD COLUMN superseded_at TEXT;

DROP INDEX IF EXISTS idx_deployments_demo_baseline;

CREATE UNIQUE INDEX IF NOT EXISTS idx_deployments_active_baseline
  ON deployments(service_name, environment_name)
  WHERE role = 'baseline' AND status = 'succeeded' AND superseded_at IS NULL;
