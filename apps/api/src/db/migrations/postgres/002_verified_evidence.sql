-- PostgreSQL translation of 002_verified_evidence.sql.
-- Kept as a separate file because DDL, unlike DML, genuinely differs
-- between the two engines.

ALTER TABLE changes ADD COLUMN ai_verification_state TEXT NOT NULL DEFAULT 'unverified'
  CHECK (ai_verification_state IN ('missing', 'invalid', 'unverified', 'verified', 'failed'));
ALTER TABLE changes ADD COLUMN ai_verified_at TEXT;
ALTER TABLE changes ADD COLUMN ai_verification_error TEXT;

ALTER TABLE pipeline_runs ADD COLUMN export_state TEXT NOT NULL DEFAULT 'pending'
  CHECK (export_state IN ('pending', 'exported', 'verified', 'failed'));
ALTER TABLE pipeline_runs ADD COLUMN export_error TEXT;
ALTER TABLE pipeline_runs ADD COLUMN verified_at TEXT;

ALTER TABLE deployments ADD COLUMN provider TEXT NOT NULL DEFAULT 'api';
ALTER TABLE deployments ADD COLUMN idempotency_key TEXT;
ALTER TABLE deployments ADD COLUMN health_url TEXT;
ALTER TABLE deployments ADD COLUMN route TEXT;
ALTER TABLE deployments ADD COLUMN image_digest TEXT;
ALTER TABLE deployments ADD COLUMN readiness_at TEXT;
ALTER TABLE deployments ADD COLUMN evaluation_not_before TEXT;
ALTER TABLE deployments ADD COLUMN version_state TEXT NOT NULL DEFAULT 'pending'
  CHECK (version_state IN ('pending', 'verified', 'failed'));
ALTER TABLE deployments ADD COLUMN trace_state TEXT NOT NULL DEFAULT 'pending'
  CHECK (trace_state IN ('pending', 'exported', 'verified', 'failed'));
ALTER TABLE deployments ADD COLUMN verification_error TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_deployments_idempotency
  ON deployments(provider, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE pipeline_export_attempts (
  id TEXT PRIMARY KEY,
  pipeline_run_id TEXT NOT NULL REFERENCES pipeline_runs(id),
  attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
  state TEXT NOT NULL CHECK (state IN ('pending', 'exported', 'verified', 'failed')),
  trace_id TEXT,
  error_code TEXT,
  error_message TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE(pipeline_run_id, attempt_number)
);

CREATE TABLE baseline_snapshots (
  id TEXT PRIMARY KEY,
  deployment_id TEXT NOT NULL REFERENCES deployments(id),
  service_name TEXT NOT NULL,
  service_version TEXT NOT NULL,
  environment_name TEXT NOT NULL,
  route TEXT NOT NULL,
  window_start TEXT NOT NULL,
  window_end TEXT NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count >= 0),
  p90_ms REAL NOT NULL CHECK (p90_ms >= 0),
  p95_ms REAL NOT NULL CHECK (p95_ms >= 0),
  error_rate REAL NOT NULL CHECK (error_rate >= 0),
  thresholds_json TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  UNIQUE(deployment_id, route, window_start, window_end)
);

CREATE TABLE evaluation_windows (
  id TEXT PRIMARY KEY,
  deployment_id TEXT NOT NULL REFERENCES deployments(id),
  baseline_snapshot_id TEXT NOT NULL REFERENCES baseline_snapshots(id),
  kind TEXT NOT NULL CHECK (kind IN ('candidate', 'recovery')),
  service_name TEXT NOT NULL,
  service_version TEXT NOT NULL,
  environment_name TEXT NOT NULL,
  route TEXT NOT NULL,
  window_start TEXT NOT NULL,
  window_end TEXT NOT NULL,
  not_before TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(deployment_id, kind, route)
);

ALTER TABLE evidence_links RENAME TO evidence_links_legacy;
ALTER TABLE regression_evaluations RENAME TO regression_evaluations_legacy;

CREATE TABLE regression_incidents (
  id TEXT PRIMARY KEY,
  candidate_deployment_id TEXT NOT NULL REFERENCES deployments(id),
  baseline_snapshot_id TEXT NOT NULL REFERENCES baseline_snapshots(id),
  recovery_deployment_id TEXT REFERENCES deployments(id),
  service_name TEXT NOT NULL,
  environment_name TEXT NOT NULL,
  route TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('open', 'recovery_pending', 'recovered', 'unresolved')
  ),
  opened_at TEXT NOT NULL,
  recovered_at TEXT,
  UNIQUE(candidate_deployment_id, route)
);

CREATE TABLE regression_evaluations (
  id TEXT PRIMARY KEY,
  deployment_id TEXT NOT NULL REFERENCES deployments(id),
  baseline_deployment_id TEXT NOT NULL REFERENCES deployments(id),
  baseline_snapshot_id TEXT REFERENCES baseline_snapshots(id),
  evaluation_window_id TEXT REFERENCES evaluation_windows(id),
  incident_id TEXT REFERENCES regression_incidents(id),
  route TEXT NOT NULL,
  comparison_kind TEXT NOT NULL CHECK (
    comparison_kind IN ('deployment', 'recovery')
  ),
  baseline_service_version TEXT NOT NULL,
  observed_service_version TEXT NOT NULL,
  baseline_start TEXT NOT NULL,
  baseline_end TEXT NOT NULL,
  observed_start TEXT NOT NULL,
  observed_end TEXT NOT NULL,
  baseline_request_count INTEGER,
  observed_request_count INTEGER,
  baseline_p90_ms REAL,
  observed_p90_ms REAL,
  baseline_p95_ms REAL,
  observed_p95_ms REAL,
  latency_delta_pct REAL,
  baseline_error_rate REAL,
  observed_error_rate REAL,
  thresholds_json TEXT NOT NULL,
  policy_version TEXT NOT NULL DEFAULT 'v1',
  status TEXT NOT NULL CHECK (
    status IN ('insufficient_data', 'integration_error', 'healthy', 'regressed', 'recovered')
  ),
  reasons_json TEXT NOT NULL,
  integration_error_code TEXT,
  signoz_dashboard_url TEXT,
  evaluated_at TEXT NOT NULL
);

INSERT INTO regression_evaluations (
  id, deployment_id, baseline_deployment_id, route, comparison_kind,
  baseline_service_version, observed_service_version,
  baseline_start, baseline_end, observed_start, observed_end,
  baseline_request_count, observed_request_count,
  baseline_p95_ms, observed_p95_ms, latency_delta_pct,
  baseline_error_rate, observed_error_rate, thresholds_json, status,
  reasons_json, signoz_dashboard_url, evaluated_at
)
SELECT
  id, deployment_id, baseline_deployment_id, route, comparison_kind,
  baseline_service_version, observed_service_version,
  baseline_start, baseline_end, observed_start, observed_end,
  baseline_request_count, observed_request_count,
  baseline_p95_ms, observed_p95_ms, latency_delta_pct,
  baseline_error_rate, observed_error_rate,
  '{"latencyMultiplier":1.5,"latencyAdditiveMs":250,"errorRateDeltaPct":2,"errorRateAbsolutePct":5,"minSpans":200,"recoveryLatencyMultiplier":1.2,"recoveryErrorRateDeltaPct":1}',
  status, reasons_json, signoz_dashboard_url, evaluated_at
FROM regression_evaluations_legacy;

CREATE TABLE evidence_links (
  id TEXT PRIMARY KEY,
  regression_evaluation_id TEXT NOT NULL REFERENCES regression_evaluations(id),
  kind TEXT NOT NULL CHECK (
    kind IN ('signoz_trace', 'signoz_dashboard', 'github_run', 'deployment_trace', 'ai_trace')
  ),
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  ordinal INTEGER NOT NULL DEFAULT 0,
  verification_state TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_state IN ('pending', 'verified', 'failed')),
  verified_at TEXT,
  created_at TEXT NOT NULL
);

INSERT INTO evidence_links (
  id, regression_evaluation_id, kind, label, url, ordinal,
  verification_state, created_at
)
SELECT
  id, regression_evaluation_id, kind, label, url, 0, 'pending', created_at
FROM evidence_links_legacy;

DROP TABLE evidence_links_legacy;
DROP TABLE regression_evaluations_legacy;

CREATE INDEX idx_regressions_deployment ON regression_evaluations(deployment_id);
CREATE INDEX idx_regressions_baseline ON regression_evaluations(baseline_deployment_id);
CREATE INDEX idx_regressions_incident ON regression_evaluations(incident_id);
CREATE INDEX idx_evidence_order
  ON evidence_links(regression_evaluation_id, ordinal, id);
CREATE INDEX idx_incidents_scope
  ON regression_incidents(service_name, environment_name, route, opened_at);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pending', 'running', 'succeeded', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TEXT NOT NULL,
  locked_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  request_id TEXT,
  details_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
