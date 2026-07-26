/**
 * Row shapes for every table GreenLight persists.
 *
 * Kept beside the schema rather than inside a repository implementation so
 * that each storage driver describes the same rows.
 */
export type AiLinkStatus = "linked" | "missing" | "invalid";

export interface RepositoryRow {
  id: string;
  provider: "github";
  owner: string;
  name: string;
  default_branch: string;
  created_at: string;
}

export interface ChangeRow {
  id: string;
  repository_id: string;
  commit_sha: string;
  short_sha: string;
  branch: string | null;
  commit_subject: string | null;
  committed_at: string | null;
  ai_traceparent: string | null;
  ai_trace_id: string | null;
  ai_span_id: string | null;
  ai_trace_flags: string | null;
  ai_link_status: AiLinkStatus;
  ai_verification_state?: "missing" | "invalid" | "unverified" | "verified" | "failed";
  ai_verified_at?: string | null;
  ai_verification_error?: string | null;
  changed_files_count: number | null;
  additions: number | null;
  deletions: number | null;
  changed_paths_json: string | null;
  created_at: string;
}

export interface PipelineRunRow {
  id: string;
  change_id: string;
  provider_run_id: string;
  workflow_name: string;
  status: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_ms?: number | null;
  slowest_step?: string | null;
  html_url: string;
  is_primary: 0 | 1;
  emitted_trace_id: string | null;
  export_state?: "pending" | "exported" | "verified" | "failed";
  export_error?: string | null;
  verified_at?: string | null;
  synced_at: string;
}

export interface DeploymentRow {
  id: string;
  change_id: string;
  service_name: string;
  environment_name: string;
  role: "baseline" | "candidate" | "recovery";
  status: "started" | "succeeded" | "failed";
  deployed_at: string;
  emitted_trace_id: string | null;
  provider?: string;
  idempotency_key?: string | null;
  health_url?: string | null;
  route?: string | null;
  image_digest?: string | null;
  readiness_at?: string | null;
  evaluation_not_before?: string | null;
  version_state?: "pending" | "verified" | "failed";
  trace_state?: "pending" | "exported" | "verified" | "failed";
  verification_error?: string | null;
  /**
   * When this baseline stopped being the one new comparisons resolve to.
   * `null` on every candidate and recovery, and on the active baseline.
   */
  superseded_at?: string | null;
  created_at: string;
}

export interface RegressionEvaluationRow {
  id: string;
  deployment_id: string;
  baseline_deployment_id: string;
  route: string;
  comparison_kind: "deployment" | "recovery";
  baseline_service_version: string;
  observed_service_version: string;
  baseline_start: string;
  baseline_end: string;
  observed_start: string;
  observed_end: string;
  baseline_snapshot_id?: string | null;
  evaluation_window_id?: string | null;
  incident_id?: string | null;
  baseline_request_count: number | null;
  observed_request_count: number | null;
  baseline_p90_ms?: number | null;
  observed_p90_ms?: number | null;
  baseline_p95_ms: number | null;
  observed_p95_ms: number | null;
  latency_delta_pct: number | null;
  baseline_error_rate: number | null;
  observed_error_rate: number | null;
  thresholds_json?: string;
  policy_version?: string;
  status: "insufficient_data" | "integration_error" | "healthy" | "regressed" | "recovered";
  reasons_json: string;
  integration_error_code?: string | null;
  signoz_dashboard_url: string | null;
  evaluated_at: string;
}

export interface EvidenceLinkRow {
  id: string;
  regression_evaluation_id: string;
  kind: "signoz_trace" | "signoz_dashboard" | "github_run" | "deployment_trace" | "ai_trace";
  label: string;
  url: string;
  ordinal?: number;
  verification_state?: "pending" | "verified" | "failed";
  verified_at?: string | null;
  created_at: string;
}

export interface BaselineSnapshotRow {
  id: string;
  deployment_id: string;
  service_name: string;
  service_version: string;
  environment_name: string;
  route: string;
  window_start: string;
  window_end: string;
  request_count: number;
  p90_ms: number;
  p95_ms: number;
  error_rate: number;
  thresholds_json: string;
  captured_at: string;
}

export interface EvaluationWindowRow {
  id: string;
  deployment_id: string;
  baseline_snapshot_id: string;
  kind: "candidate" | "recovery";
  service_name: string;
  service_version: string;
  environment_name: string;
  route: string;
  window_start: string;
  window_end: string;
  not_before: string;
  created_at: string;
}

export interface RegressionIncidentRow {
  id: string;
  candidate_deployment_id: string;
  baseline_snapshot_id: string;
  recovery_deployment_id: string | null;
  service_name: string;
  environment_name: string;
  route: string;
  status: "open" | "recovery_pending" | "recovered" | "unresolved";
  opened_at: string;
  recovered_at: string | null;
}

export interface JobRow {
  id: string;
  kind: "github_sync_runs" | "github_sync_latest" | "deployment_record" | "regression_evaluate";
  payload_json: string;
  state: "pending" | "running" | "succeeded" | "failed";
  attempts: number;
  available_at: string;
  locked_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  result_json?: string | null;
}
