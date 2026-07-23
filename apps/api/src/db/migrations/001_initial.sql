CREATE TABLE IF NOT EXISTS repositories (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider = 'github'),
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  default_branch TEXT NOT NULL DEFAULT 'main',
  created_at TEXT NOT NULL,
  UNIQUE(provider, owner, name)
);

CREATE TABLE IF NOT EXISTS changes (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL REFERENCES repositories(id),
  commit_sha TEXT NOT NULL,
  short_sha TEXT NOT NULL,
  branch TEXT,
  commit_subject TEXT,
  committed_at TEXT,
  ai_traceparent TEXT,
  ai_trace_id TEXT,
  ai_span_id TEXT,
  ai_trace_flags TEXT,
  ai_link_status TEXT NOT NULL CHECK (
    ai_link_status IN ('linked', 'missing', 'invalid')
  ),
  changed_files_count INTEGER,
  additions INTEGER,
  deletions INTEGER,
  changed_paths_json TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(repository_id, commit_sha)
);

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id TEXT PRIMARY KEY,
  change_id TEXT NOT NULL REFERENCES changes(id),
  provider_run_id TEXT NOT NULL UNIQUE,
  workflow_name TEXT NOT NULL,
  status TEXT NOT NULL,
  conclusion TEXT,
  started_at TEXT,
  completed_at TEXT,
  html_url TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  emitted_trace_id TEXT,
  synced_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deployments (
  id TEXT PRIMARY KEY,
  change_id TEXT NOT NULL REFERENCES changes(id),
  service_name TEXT NOT NULL,
  environment_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('baseline', 'candidate', 'recovery')),
  status TEXT NOT NULL CHECK (status IN ('started', 'succeeded', 'failed')),
  deployed_at TEXT NOT NULL,
  emitted_trace_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS regression_evaluations (
  id TEXT PRIMARY KEY,
  deployment_id TEXT NOT NULL REFERENCES deployments(id),
  baseline_deployment_id TEXT NOT NULL REFERENCES deployments(id),
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
  baseline_request_count INTEGER NOT NULL,
  observed_request_count INTEGER NOT NULL,
  baseline_p95_ms REAL,
  observed_p95_ms REAL,
  latency_delta_pct REAL,
  baseline_error_rate REAL,
  observed_error_rate REAL,
  status TEXT NOT NULL CHECK (
    status IN ('insufficient_data', 'healthy', 'regressed', 'recovered')
  ),
  reasons_json TEXT NOT NULL,
  signoz_dashboard_url TEXT,
  evaluated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence_links (
  id TEXT PRIMARY KEY,
  regression_evaluation_id TEXT NOT NULL REFERENCES regression_evaluations(id),
  kind TEXT NOT NULL CHECK (kind IN ('signoz_trace', 'signoz_dashboard')),
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_changes_sha ON changes(commit_sha);
CREATE INDEX IF NOT EXISTS idx_pipeline_change ON pipeline_runs(change_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_primary_change
  ON pipeline_runs(change_id) WHERE is_primary = 1;
CREATE INDEX IF NOT EXISTS idx_deployments_change_time ON deployments(change_id, deployed_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_deployments_demo_baseline
  ON deployments(service_name, environment_name)
  WHERE role = 'baseline' AND status = 'succeeded';
CREATE INDEX IF NOT EXISTS idx_regressions_deployment ON regression_evaluations(deployment_id);
CREATE INDEX IF NOT EXISTS idx_regressions_baseline ON regression_evaluations(baseline_deployment_id);

CREATE TABLE IF NOT EXISTS schema_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL
);
