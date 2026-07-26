import type { SqlDriver } from "../driver.js";
import type { SqlParameters } from "../sql.js";
import { SqliteDriver } from "../sqlite-driver.js";

export * from "../rows.js";
import type {
  BaselineSnapshotRow,
  ChangeRow,
  DeploymentRow,
  EvaluationWindowRow,
  EvidenceLinkRow,
  JobRow,
  PipelineRunRow,
  RegressionEvaluationRow,
  RegressionIncidentRow,
  RepositoryRow,
} from "../rows.js";

/**
 * Narrows a row to the flat bag of bindable scalars a driver takes.
 *
 * Row types declare optional and union-typed fields that TypeScript cannot
 * see through to `SqlParameters`, and every caller normalises those fields to
 * `null` before binding. The assertion therefore belongs in one named place
 * rather than being restated at each statement, where it would bury the SQL.
 */
function bindings(row: object): SqlParameters {
  return row as SqlParameters;
}

/**
 * Every rule about how GreenLight's rows relate, expressed once.
 *
 * The class holds no knowledge of a particular database: statements are
 * written in the neutral `:name` placeholder form and handed to a driver,
 * so SQLite and PostgreSQL run identical SQL.
 */
export class Repositories {
  constructor(readonly driver: SqlDriver) {}

  /** Local file-backed store, for development and tests. */
  static create(path: string): Repositories {
    return new Repositories(SqliteDriver.open(path));
  }

  /**
   * Runs `operation` as one atomic unit of work.
   *
   * The repositories passed to `operation` are bound to the transaction;
   * using the outer instance inside would escape it.
   */
  transaction<T>(operation: (tx: Repositories) => Promise<T>): Promise<T> {
    return this.driver.transaction((tx) => operation(new Repositories(tx)));
  }

  async ping(): Promise<boolean> {
    try {
      const row = await this.driver.get<{ ok: number }>("SELECT 1 AS ok");
      return Number(row?.ok) === 1;
    } catch {
      return false;
    }
  }

  close(): Promise<void> {
    return this.driver.close();
  }

  async upsertRepository(input: Omit<RepositoryRow, "created_at"> & { created_at?: string }) {
    const createdAt = input.created_at ?? new Date().toISOString();
    await this.driver.run(`INSERT INTO repositories (id, provider, owner, name, default_branch, created_at)
         VALUES (:id, :provider, :owner, :name, :default_branch, :created_at)
         ON CONFLICT(provider, owner, name) DO UPDATE SET
           default_branch = excluded.default_branch`, bindings({ ...input, created_at: createdAt }));
  }

  async upsertChange(input: ChangeRow) {
    const enriched = {
      ...input,
      ai_verification_state: input.ai_verification_state ?? (
        input.ai_link_status === "linked" ? "unverified" : input.ai_link_status
      ),
      ai_verified_at: input.ai_verified_at ?? null,
      ai_verification_error: input.ai_verification_error ?? null,
    };
    await this.driver.run(`INSERT INTO changes (
          id, repository_id, commit_sha, short_sha, branch, commit_subject, committed_at,
          ai_traceparent, ai_trace_id, ai_span_id, ai_trace_flags, ai_link_status,
          ai_verification_state, ai_verified_at, ai_verification_error,
          changed_files_count, additions, deletions, changed_paths_json, created_at
        ) VALUES (
          :id, :repository_id, :commit_sha, :short_sha, :branch, :commit_subject, :committed_at,
          :ai_traceparent, :ai_trace_id, :ai_span_id, :ai_trace_flags, :ai_link_status,
          :ai_verification_state, :ai_verified_at, :ai_verification_error,
          :changed_files_count, :additions, :deletions, :changed_paths_json, :created_at
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
          ai_verification_state = excluded.ai_verification_state,
          ai_verified_at = excluded.ai_verified_at,
          ai_verification_error = excluded.ai_verification_error,
          changed_files_count = excluded.changed_files_count,
          additions = excluded.additions,
          deletions = excluded.deletions,
          changed_paths_json = excluded.changed_paths_json`, bindings(enriched));
  }

  async upsertPipelineRun(input: PipelineRunRow) {
    const enriched = {
      ...input,
      duration_ms: input.duration_ms ?? null,
      slowest_step: input.slowest_step ?? null,
      export_state: input.export_state ?? (input.emitted_trace_id ? "exported" : "pending"),
      export_error: input.export_error ?? null,
      verified_at: input.verified_at ?? null,
    };
    await this.driver.run(`INSERT INTO pipeline_runs (
          id, change_id, provider_run_id, workflow_name, status, conclusion,
          started_at, completed_at, duration_ms, slowest_step, html_url, is_primary, emitted_trace_id,
          export_state, export_error, verified_at, synced_at
        ) VALUES (
          :id, :change_id, :provider_run_id, :workflow_name, :status, :conclusion,
          :started_at, :completed_at, :duration_ms, :slowest_step, :html_url, :is_primary, :emitted_trace_id,
          :export_state, :export_error, :verified_at, :synced_at
        )
        ON CONFLICT(provider_run_id) DO UPDATE SET
          status = excluded.status,
          conclusion = excluded.conclusion,
          started_at = excluded.started_at,
          completed_at = excluded.completed_at,
          duration_ms = excluded.duration_ms,
          slowest_step = excluded.slowest_step,
          html_url = excluded.html_url,
          is_primary = excluded.is_primary,
          emitted_trace_id = excluded.emitted_trace_id,
          export_state = excluded.export_state,
          export_error = excluded.export_error,
          verified_at = excluded.verified_at,
          synced_at = excluded.synced_at`, bindings(enriched));
  }

  async updatePipelineExport(input: {
    pipelineRunId: string;
    state: "pending" | "exported" | "verified" | "failed";
    traceId?: string | null;
    error?: string | null;
    verifiedAt?: string | null;
  }): Promise<void> {
    await this.driver.run(`UPDATE pipeline_runs
         SET export_state = :p1, emitted_trace_id = :p2, export_error = :p3, verified_at = :p4
         WHERE id = :p5`, { p1: input.state, p2: input.traceId ?? null, p3: input.error ?? null, p4: input.verifiedAt ?? null, p5: input.pipelineRunId });
  }

  async clearPrimaryForChange(changeId: string) {
    await this.driver.run("UPDATE pipeline_runs SET is_primary = 0 WHERE change_id = :p1", { p1: changeId });
  }

  async insertDeployment(input: DeploymentRow) {
    const enriched = {
      ...input,
      provider: input.provider ?? "api",
      idempotency_key: input.idempotency_key ?? null,
      health_url: input.health_url ?? null,
      route: input.route ?? null,
      image_digest: input.image_digest ?? null,
      readiness_at: input.readiness_at ?? null,
      evaluation_not_before: input.evaluation_not_before ?? null,
      version_state: input.version_state ?? "pending",
      trace_state: input.trace_state ?? "pending",
      verification_error: input.verification_error ?? null,
      superseded_at: input.superseded_at ?? null,
    };
    // `superseded_at` is deliberately absent from the conflict update: replaying
    // a delivery of a deployment that has since been retired must not quietly
    // make it active again.
    await this.driver.run(`INSERT INTO deployments (
          id, change_id, service_name, environment_name, role, status, deployed_at,
          emitted_trace_id, provider, idempotency_key, health_url, route, image_digest,
          readiness_at, evaluation_not_before, version_state, trace_state,
          verification_error, superseded_at, created_at
        ) VALUES (
          :id, :change_id, :service_name, :environment_name, :role, :status, :deployed_at,
          :emitted_trace_id, :provider, :idempotency_key, :health_url, :route, :image_digest,
          :readiness_at, :evaluation_not_before, :version_state, :trace_state,
          :verification_error, :superseded_at, :created_at
        )
        ON CONFLICT(provider, idempotency_key) WHERE idempotency_key IS NOT NULL DO UPDATE SET
          status = excluded.status,
          deployed_at = excluded.deployed_at,
          emitted_trace_id = COALESCE(excluded.emitted_trace_id, deployments.emitted_trace_id),
          readiness_at = COALESCE(excluded.readiness_at, deployments.readiness_at),
          evaluation_not_before = COALESCE(excluded.evaluation_not_before, deployments.evaluation_not_before),
          version_state = excluded.version_state,
          trace_state = excluded.trace_state,
          verification_error = excluded.verification_error`, bindings(enriched));
  }

  async insertRegressionEvaluation(input: RegressionEvaluationRow) {
    const enriched = {
      ...input,
      baseline_snapshot_id: input.baseline_snapshot_id ?? null,
      evaluation_window_id: input.evaluation_window_id ?? null,
      incident_id: input.incident_id ?? null,
      baseline_p90_ms: input.baseline_p90_ms ?? null,
      observed_p90_ms: input.observed_p90_ms ?? null,
      thresholds_json: input.thresholds_json ?? "{}",
      policy_version: input.policy_version ?? "v1",
      integration_error_code: input.integration_error_code ?? null,
    };
    await this.driver.run(`INSERT INTO regression_evaluations (
          id, deployment_id, baseline_deployment_id, baseline_snapshot_id,
          evaluation_window_id, incident_id, route, comparison_kind,
          baseline_service_version, observed_service_version,
          baseline_start, baseline_end, observed_start, observed_end,
          baseline_request_count, observed_request_count,
          baseline_p90_ms, observed_p90_ms, baseline_p95_ms, observed_p95_ms, latency_delta_pct,
          baseline_error_rate, observed_error_rate, status, reasons_json,
          thresholds_json, policy_version, integration_error_code,
          signoz_dashboard_url, evaluated_at
        ) VALUES (
          :id, :deployment_id, :baseline_deployment_id, :baseline_snapshot_id,
          :evaluation_window_id, :incident_id, :route, :comparison_kind,
          :baseline_service_version, :observed_service_version,
          :baseline_start, :baseline_end, :observed_start, :observed_end,
          :baseline_request_count, :observed_request_count,
          :baseline_p90_ms, :observed_p90_ms, :baseline_p95_ms, :observed_p95_ms, :latency_delta_pct,
          :baseline_error_rate, :observed_error_rate, :status, :reasons_json,
          :thresholds_json, :policy_version, :integration_error_code,
          :signoz_dashboard_url, :evaluated_at
        )
        ON CONFLICT(id) DO UPDATE SET
          baseline_deployment_id = excluded.baseline_deployment_id,
          baseline_snapshot_id = excluded.baseline_snapshot_id,
          evaluation_window_id = excluded.evaluation_window_id,
          incident_id = excluded.incident_id,
          baseline_service_version = excluded.baseline_service_version,
          observed_service_version = excluded.observed_service_version,
          baseline_start = excluded.baseline_start,
          baseline_end = excluded.baseline_end,
          observed_start = excluded.observed_start,
          observed_end = excluded.observed_end,
          baseline_request_count = excluded.baseline_request_count,
          observed_request_count = excluded.observed_request_count,
          baseline_p90_ms = excluded.baseline_p90_ms,
          observed_p90_ms = excluded.observed_p90_ms,
          baseline_p95_ms = excluded.baseline_p95_ms,
          observed_p95_ms = excluded.observed_p95_ms,
          latency_delta_pct = excluded.latency_delta_pct,
          baseline_error_rate = excluded.baseline_error_rate,
          observed_error_rate = excluded.observed_error_rate,
          status = excluded.status,
          reasons_json = excluded.reasons_json,
          thresholds_json = excluded.thresholds_json,
          policy_version = excluded.policy_version,
          integration_error_code = excluded.integration_error_code,
          signoz_dashboard_url = excluded.signoz_dashboard_url,
          evaluated_at = excluded.evaluated_at`, bindings(enriched));
  }

  /**
   * Replaces the evidence set for an evaluation.
   *
   * Evidence is derived state: a re-run must not leave links from a
   * superseded attempt visible alongside the current ones.
   */
  async replaceEvidenceLinks(evaluationId: string, links: EvidenceLinkRow[]) {
    await this.transaction(async (tx) => {
      await tx.driver.run(
        "DELETE FROM evidence_links WHERE regression_evaluation_id = :p1",
        { p1: evaluationId },
      );
      await tx.insertEvidenceLinks(links);
    });
  }

  async insertEvidenceLinks(links: EvidenceLinkRow[]) {
    const sql = `INSERT INTO evidence_links (
         id, regression_evaluation_id, kind, label, url, ordinal,
         verification_state, verified_at, created_at
       )
       VALUES (
         :id, :regression_evaluation_id, :kind, :label, :url, :ordinal,
         :verification_state, :verified_at, :created_at
       )
       ON CONFLICT(id) DO UPDATE SET
         kind = excluded.kind,
         label = excluded.label,
         url = excluded.url,
         ordinal = excluded.ordinal,
         verification_state = excluded.verification_state,
         verified_at = excluded.verified_at`;
    for (const [index, link] of links.entries()) {
      await this.driver.run(sql, bindings({
        ...link,
        ordinal: link.ordinal ?? index,
        verification_state: link.verification_state ?? "pending",
        verified_at: link.verified_at ?? null,
      }));
    }
  }

  async getEvidenceLinksForEvaluation(evaluationId: string): Promise<EvidenceLinkRow[]> {
    return this.driver.all<EvidenceLinkRow>(`SELECT * FROM evidence_links
         WHERE regression_evaluation_id = :p1
         ORDER BY ordinal ASC, id ASC`, { p1: evaluationId });
  }

  async listRegressionEvaluations(limit = 100): Promise<RegressionEvaluationRow[]> {
    return this.driver.all<RegressionEvaluationRow>("SELECT * FROM regression_evaluations ORDER BY evaluated_at DESC LIMIT :p1", { p1: limit });
  }

  async listDeployments(limit = 100): Promise<DeploymentRow[]> {
    return this.driver.all<DeploymentRow>("SELECT * FROM deployments ORDER BY deployed_at DESC LIMIT :p1", { p1: limit });
  }

  /**
   * Resolves the *active* baseline for a service/environment through an indexed
   * lookup rather than scanning every deployment in the table.
   *
   * Retired baselines are excluded here but never deleted: an evaluation that
   * cites one is still read by id, so an old verdict stays explainable with the
   * baseline it was actually measured against.
   */
  async listBaselineDeployments(serviceName: string, environmentName: string): Promise<DeploymentRow[]> {
    return this.driver.all<DeploymentRow>(`SELECT * FROM deployments
         WHERE service_name = :p1 AND environment_name = :p2
           AND role = 'baseline' AND status = 'succeeded'
           AND superseded_at IS NULL
         ORDER BY deployed_at ASC`, { p1: serviceName, p2: environmentName });
  }

  /**
   * Retires whichever baseline is currently active for a service/environment.
   *
   * A no-op when none is active, so the caller does not have to look first —
   * and, run inside the same transaction as the replacement's insert, the
   * partial unique index makes the swap atomic.
   */
  async supersedeBaselineDeployments(
    serviceName: string,
    environmentName: string,
    supersededAt: string,
  ): Promise<void> {
    await this.driver.run(`UPDATE deployments
         SET superseded_at = :p3
         WHERE service_name = :p1 AND environment_name = :p2
           AND role = 'baseline' AND status = 'succeeded'
           AND superseded_at IS NULL`, {
      p1: serviceName,
      p2: environmentName,
      p3: supersededAt,
    });
  }

  async getRepositoryByOwnerName(owner: string, name: string): Promise<RepositoryRow | undefined> {
    return this.driver.get<RepositoryRow>("SELECT * FROM repositories WHERE owner = :p1 AND name = :p2", { p1: owner, p2: name });
  }

  async getChangeBySha(commitSha: string): Promise<ChangeRow | undefined> {
    return this.driver.get<ChangeRow>("SELECT * FROM changes WHERE commit_sha = :p1", { p1: commitSha });
  }

  async getChangeForDeployment(deploymentId: string): Promise<ChangeRow | undefined> {
    return this.driver.get<ChangeRow>(`SELECT changes.*
         FROM deployments
         JOIN changes ON changes.id = deployments.change_id
         WHERE deployments.id = :p1`, { p1: deploymentId });
  }

  async listChanges(limit = 20): Promise<ChangeRow[]> {
    return this.driver.all<ChangeRow>("SELECT * FROM changes ORDER BY created_at DESC LIMIT :p1", { p1: limit });
  }

  async getPipelineRunsForChange(changeId: string): Promise<PipelineRunRow[]> {
    return this.driver.all<PipelineRunRow>("SELECT * FROM pipeline_runs WHERE change_id = :p1 ORDER BY synced_at DESC", { p1: changeId });
  }

  async getPrimaryPipelineRun(changeId: string): Promise<PipelineRunRow | undefined> {
    return this.driver.get<PipelineRunRow>("SELECT * FROM pipeline_runs WHERE change_id = :p1 AND is_primary = 1", { p1: changeId });
  }

  async getDeploymentsForChange(changeId: string): Promise<DeploymentRow[]> {
    return this.driver.all<DeploymentRow>("SELECT * FROM deployments WHERE change_id = :p1 ORDER BY deployed_at DESC", { p1: changeId });
  }

  async getBaselineDeployment(
    serviceName: string,
    environmentName: string,
  ): Promise<DeploymentRow | undefined> {
    return this.driver.get<DeploymentRow>(`SELECT * FROM deployments
         WHERE service_name = :p1 AND environment_name = :p2
           AND role = 'baseline' AND status = 'succeeded'
           AND superseded_at IS NULL
         ORDER BY deployed_at ASC LIMIT 1`, { p1: serviceName, p2: environmentName });
  }

  async getLatestEvaluationForDeployment(
    deploymentId: string,
  ): Promise<RegressionEvaluationRow | undefined> {
    return this.driver.get<RegressionEvaluationRow>(`SELECT * FROM regression_evaluations
         WHERE deployment_id = :p1
         ORDER BY evaluated_at DESC LIMIT 1`, { p1: deploymentId });
  }

  async getDeploymentById(deploymentId: string): Promise<DeploymentRow | undefined> {
    return this.driver.get<DeploymentRow>("SELECT * FROM deployments WHERE id = :p1", { p1: deploymentId });
  }

  async getDeploymentByIdempotencyKey(provider: string, idempotencyKey: string): Promise<DeploymentRow | undefined> {
    return this.driver.get<DeploymentRow>("SELECT * FROM deployments WHERE provider = :p1 AND idempotency_key = :p2", { p1: provider, p2: idempotencyKey });
  }

  async insertIncident(input: RegressionIncidentRow) {
    await this.driver.run(`INSERT INTO regression_incidents (
          id, candidate_deployment_id, baseline_snapshot_id, recovery_deployment_id,
          service_name, environment_name, route, status, opened_at, recovered_at
        ) VALUES (
          :id, :candidate_deployment_id, :baseline_snapshot_id, :recovery_deployment_id,
          :service_name, :environment_name, :route, :status, :opened_at, :recovered_at
        )
        ON CONFLICT(candidate_deployment_id, route) DO UPDATE SET
          recovery_deployment_id = COALESCE(excluded.recovery_deployment_id, regression_incidents.recovery_deployment_id),
          status = excluded.status,
          recovered_at = excluded.recovered_at`, bindings(input));
  }

  async getIncidentForCandidate(deploymentId: string, route?: string): Promise<RegressionIncidentRow | undefined> {
    if (route) {
      return this.driver.get<RegressionIncidentRow>(`SELECT * FROM regression_incidents
           WHERE candidate_deployment_id = :p1 AND route = :p2`, { p1: deploymentId, p2: route });
    }
    return this.driver.get<RegressionIncidentRow>(`SELECT * FROM regression_incidents
         WHERE candidate_deployment_id = :p1
         ORDER BY opened_at DESC LIMIT 1`, { p1: deploymentId });
  }

  async getBaselineSnapshot(snapshotId: string): Promise<BaselineSnapshotRow | undefined> {
    return this.driver.get<BaselineSnapshotRow>("SELECT * FROM baseline_snapshots WHERE id = :p1", { p1: snapshotId });
  }

  async getBaselineSnapshotForDeployment(
    deploymentId: string,
    route: string,
  ): Promise<BaselineSnapshotRow | undefined> {
    return this.driver.get<BaselineSnapshotRow>(`SELECT * FROM baseline_snapshots
         WHERE deployment_id = :p1 AND route = :p2
         ORDER BY captured_at ASC LIMIT 1`, { p1: deploymentId, p2: route });
  }

  async insertBaselineSnapshot(input: BaselineSnapshotRow) {
    await this.driver.run(`INSERT INTO baseline_snapshots (
          id, deployment_id, service_name, service_version, environment_name, route,
          window_start, window_end, request_count, p90_ms, p95_ms, error_rate,
          thresholds_json, captured_at
        ) VALUES (
          :id, :deployment_id, :service_name, :service_version, :environment_name, :route,
          :window_start, :window_end, :request_count, :p90_ms, :p95_ms, :error_rate,
          :thresholds_json, :captured_at
        )`, bindings(input));
  }

  async insertEvaluationWindow(input: EvaluationWindowRow) {
    await this.driver.run(`INSERT INTO evaluation_windows (
          id, deployment_id, baseline_snapshot_id, kind, service_name,
          service_version, environment_name, route, window_start, window_end,
          not_before, created_at
        ) VALUES (
          :id, :deployment_id, :baseline_snapshot_id, :kind, :service_name,
          :service_version, :environment_name, :route, :window_start, :window_end,
          :not_before, :created_at
        )
        ON CONFLICT(deployment_id, kind, route) DO NOTHING`, bindings(input));
  }

  async getEvaluationWindow(
    deploymentId: string,
    kind: "candidate" | "recovery",
    route: string,
  ): Promise<EvaluationWindowRow | undefined> {
    return this.driver.get<EvaluationWindowRow>(`SELECT * FROM evaluation_windows
         WHERE deployment_id = :p1 AND kind = :p2 AND route = :p3`, { p1: deploymentId, p2: kind, p3: route });
  }

  async getIncidentById(incidentId: string): Promise<RegressionIncidentRow | undefined> {
    return this.driver.get<RegressionIncidentRow>("SELECT * FROM regression_incidents WHERE id = :p1", { p1: incidentId });
  }

  async getOpenIncidentForScope(
    serviceName: string,
    environmentName: string,
    route: string,
  ): Promise<RegressionIncidentRow | undefined> {
    return this.driver.get<RegressionIncidentRow>(`SELECT * FROM regression_incidents
         WHERE service_name = :p1 AND environment_name = :p2 AND route = :p3
           AND status IN ('open', 'recovery_pending')
         ORDER BY opened_at DESC LIMIT 1`, { p1: serviceName, p2: environmentName, p3: route });
  }

  async enqueueJob(input: Pick<JobRow, "id" | "kind" | "payload_json">): Promise<JobRow> {
    const now = new Date().toISOString();
    await this.driver.run(`INSERT INTO jobs (
          id, kind, payload_json, state, attempts, available_at,
          locked_at, last_error, created_at, updated_at
        ) VALUES (:p1, :p2, :p3, 'pending', 0, :p4, NULL, NULL, :p5, :p6)`, { p1: input.id, p2: input.kind, p3: input.payload_json, p4: now, p5: now, p6: now });
    return await this.getJob(input.id) as JobRow;
  }

  async getJob(jobId: string): Promise<JobRow | undefined> {
    return this.driver.get<JobRow>("SELECT * FROM jobs WHERE id = :p1", { p1: jobId });
  }

  /**
   * Job counts per state, including states with no rows.
   *
   * A state that has drained must report zero rather than disappear: a gauge
   * that stops reporting looks identical to a collector that stopped, and the
   * difference matters when the question is whether work is stuck.
   */
  async countJobsByState(): Promise<Record<string, number>> {
    const rows = await this.driver.all<{ state: string; count: number }>(
      "SELECT state, COUNT(*) AS count FROM jobs GROUP BY state",
    );
    const counts: Record<string, number> = {
      pending: 0,
      running: 0,
      succeeded: 0,
      failed: 0,
    };
    for (const row of rows) {
      counts[row.state] = Number(row.count);
    }
    return counts;
  }

  async recoverStaleJobs(staleBefore: string) {
    await this.driver.run(`UPDATE jobs
         SET state = 'pending', locked_at = NULL, available_at = :p1, updated_at = :p2
         WHERE state = 'running' AND locked_at < :p3`, { p1: new Date().toISOString(), p2: new Date().toISOString(), p3: staleBefore });
  }

  /**
   * Claims the next runnable job, atomically.
   *
   * Selecting a row and then updating it lets two workers read the same row
   * before either writes. The claim is therefore a single conditional update
   * that returns the row only if this caller is the one that changed it, so a
   * worker that loses the race gets nothing rather than a job someone else
   * is already running.
   */
  async claimNextJob(now: string): Promise<JobRow | undefined> {
    return this.driver.get<JobRow>(
      `UPDATE jobs
          SET state = 'running', attempts = attempts + 1, locked_at = :now, updated_at = :now
        WHERE id = (
                SELECT id FROM jobs
                 WHERE state = 'pending' AND available_at <= :now
                 ORDER BY available_at ASC, created_at ASC
                 LIMIT 1
              )
          AND state = 'pending'
        RETURNING *`,
      { now },
    );
  }

  async completeJob(jobId: string, now: string, result: unknown) {
    await this.driver.run(`UPDATE jobs
         SET state = 'succeeded', locked_at = NULL, last_error = NULL,
             result_json = :p1, updated_at = :p2
         WHERE id = :p3`, { p1: JSON.stringify(result ?? null), p2: now, p3: jobId });
  }

  async failJob(jobId: string, error: string, availableAt: string, terminal: boolean) {
    await this.driver.run(`UPDATE jobs
         SET state = :p1, locked_at = NULL, last_error = :p2, result_json = NULL,
             available_at = :p3, updated_at = :p4
         WHERE id = :p5`, { p1: terminal ? "failed" : "pending", p2: error.slice(0, 2_000), p3: availableAt, p4: new Date().toISOString(), p5: jobId });
  }

  async insertAuditEvent(input: {
    id: string;
    actor_id: string;
    action: string;
    resource_type: string;
    resource_id: string | null;
    request_id: string | null;
    details_json: string;
    created_at: string;
  }): Promise<void> {
    await this.driver.run(`INSERT INTO audit_events (
          id, actor_id, action, resource_type, resource_id,
          request_id, details_json, created_at
        ) VALUES (
          :id, :actor_id, :action, :resource_type, :resource_id,
          :request_id, :details_json, :created_at
        )`, input);
  }
}
