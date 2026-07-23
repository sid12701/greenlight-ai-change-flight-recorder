import type { DatabaseSync } from "node:sqlite";
import { createDatabase } from "../migrate.js";

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
  html_url: string;
  is_primary: 0 | 1;
  emitted_trace_id: string | null;
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
  baseline_request_count: number;
  observed_request_count: number;
  baseline_p95_ms: number | null;
  observed_p95_ms: number | null;
  latency_delta_pct: number | null;
  baseline_error_rate: number | null;
  observed_error_rate: number | null;
  status: "insufficient_data" | "healthy" | "regressed" | "recovered";
  reasons_json: string;
  signoz_dashboard_url: string | null;
  evaluated_at: string;
}

export class Repositories {
  constructor(private readonly db: DatabaseSync) {}

  static create(path: string): Repositories {
    return new Repositories(createDatabase(path));
  }

  upsertRepository(input: Omit<RepositoryRow, "created_at"> & { created_at?: string }) {
    const createdAt = input.created_at ?? new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO repositories (id, provider, owner, name, default_branch, created_at)
         VALUES (@id, @provider, @owner, @name, @default_branch, @created_at)
         ON CONFLICT(provider, owner, name) DO UPDATE SET
           default_branch = excluded.default_branch`,
      )
      .run({ ...input, created_at: createdAt });
  }

  upsertChange(input: ChangeRow) {
    this.db
      .prepare(
        `INSERT INTO changes (
          id, repository_id, commit_sha, short_sha, branch, commit_subject, committed_at,
          ai_traceparent, ai_trace_id, ai_span_id, ai_trace_flags, ai_link_status,
          changed_files_count, additions, deletions, changed_paths_json, created_at
        ) VALUES (
          @id, @repository_id, @commit_sha, @short_sha, @branch, @commit_subject, @committed_at,
          @ai_traceparent, @ai_trace_id, @ai_span_id, @ai_trace_flags, @ai_link_status,
          @changed_files_count, @additions, @deletions, @changed_paths_json, @created_at
        )
        ON CONFLICT(repository_id, commit_sha) DO UPDATE SET
          branch = excluded.branch,
          commit_subject = excluded.commit_subject,
          committed_at = excluded.committed_at,
          ai_traceparent = excluded.ai_traceparent,
          ai_trace_id = excluded.ai_trace_id,
          ai_span_id = excluded.ai_span_id,
          ai_trace_flags = excluded.ai_trace_flags,
          ai_link_status = excluded.ai_link_status,
          changed_files_count = excluded.changed_files_count,
          additions = excluded.additions,
          deletions = excluded.deletions,
          changed_paths_json = excluded.changed_paths_json`,
      )
      .run(input);
  }

  upsertPipelineRun(input: PipelineRunRow) {
    this.db
      .prepare(
        `INSERT INTO pipeline_runs (
          id, change_id, provider_run_id, workflow_name, status, conclusion,
          started_at, completed_at, html_url, is_primary, emitted_trace_id, synced_at
        ) VALUES (
          @id, @change_id, @provider_run_id, @workflow_name, @status, @conclusion,
          @started_at, @completed_at, @html_url, @is_primary, @emitted_trace_id, @synced_at
        )
        ON CONFLICT(provider_run_id) DO UPDATE SET
          status = excluded.status,
          conclusion = excluded.conclusion,
          started_at = excluded.started_at,
          completed_at = excluded.completed_at,
          html_url = excluded.html_url,
          is_primary = excluded.is_primary,
          emitted_trace_id = COALESCE(pipeline_runs.emitted_trace_id, excluded.emitted_trace_id),
          synced_at = excluded.synced_at`,
      )
      .run(input);
  }

  clearPrimaryForChange(changeId: string) {
    this.db
      .prepare("UPDATE pipeline_runs SET is_primary = 0 WHERE change_id = ?")
      .run(changeId);
  }

  insertDeployment(input: DeploymentRow) {
    this.db
      .prepare(
        `INSERT INTO deployments (
          id, change_id, service_name, environment_name, role, status, deployed_at, emitted_trace_id, created_at
        ) VALUES (
          @id, @change_id, @service_name, @environment_name, @role, @status, @deployed_at, @emitted_trace_id, @created_at
        )`,
      )
      .run(input);
  }

  insertRegressionEvaluation(input: RegressionEvaluationRow) {
    this.db
      .prepare(
        `INSERT INTO regression_evaluations (
          id, deployment_id, baseline_deployment_id, route, comparison_kind,
          baseline_service_version, observed_service_version,
          baseline_start, baseline_end, observed_start, observed_end,
          baseline_request_count, observed_request_count,
          baseline_p95_ms, observed_p95_ms, latency_delta_pct,
          baseline_error_rate, observed_error_rate, status, reasons_json,
          signoz_dashboard_url, evaluated_at
        ) VALUES (
          @id, @deployment_id, @baseline_deployment_id, @route, @comparison_kind,
          @baseline_service_version, @observed_service_version,
          @baseline_start, @baseline_end, @observed_start, @observed_end,
          @baseline_request_count, @observed_request_count,
          @baseline_p95_ms, @observed_p95_ms, @latency_delta_pct,
          @baseline_error_rate, @observed_error_rate, @status, @reasons_json,
          @signoz_dashboard_url, @evaluated_at
        )`,
      )
      .run(input);
  }

  getChangeBySha(commitSha: string): ChangeRow | undefined {
    return this.db
      .prepare("SELECT * FROM changes WHERE commit_sha = ?")
      .get(commitSha) as ChangeRow | undefined;
  }

  listChanges(limit = 20): ChangeRow[] {
    return this.db
      .prepare("SELECT * FROM changes ORDER BY created_at DESC LIMIT ?")
      .all(limit) as ChangeRow[];
  }

  getPipelineRunsForChange(changeId: string): PipelineRunRow[] {
    return this.db
      .prepare("SELECT * FROM pipeline_runs WHERE change_id = ? ORDER BY synced_at DESC")
      .all(changeId) as PipelineRunRow[];
  }

  getPrimaryPipelineRun(changeId: string): PipelineRunRow | undefined {
    return this.db
      .prepare("SELECT * FROM pipeline_runs WHERE change_id = ? AND is_primary = 1")
      .get(changeId) as PipelineRunRow | undefined;
  }

  getDeploymentsForChange(changeId: string): DeploymentRow[] {
    return this.db
      .prepare("SELECT * FROM deployments WHERE change_id = ? ORDER BY deployed_at DESC")
      .all(changeId) as DeploymentRow[];
  }

  getBaselineDeployment(
    serviceName: string,
    environmentName: string,
  ): DeploymentRow | undefined {
    return this.db
      .prepare(
        `SELECT * FROM deployments
         WHERE service_name = ? AND environment_name = ?
           AND role = 'baseline' AND status = 'succeeded'
         ORDER BY deployed_at ASC LIMIT 1`,
      )
      .get(serviceName, environmentName) as DeploymentRow | undefined;
  }

  getLatestEvaluationForDeployment(
    deploymentId: string,
  ): RegressionEvaluationRow | undefined {
    return this.db
      .prepare(
        `SELECT * FROM regression_evaluations
         WHERE deployment_id = ?
         ORDER BY evaluated_at DESC LIMIT 1`,
      )
      .get(deploymentId) as RegressionEvaluationRow | undefined;
  }
}
