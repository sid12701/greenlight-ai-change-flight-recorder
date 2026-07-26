import type { SpanContext } from "./traceparent.js";

export type AiLinkStatus = "linked" | "missing" | "invalid";
export type VerificationState = "missing" | "invalid" | "unverified" | "verified" | "failed";
export type RegressionStatus =
  | "insufficient_data"
  | "integration_error"
  | "healthy"
  | "regressed"
  | "recovered";

export interface ChangeSummary {
  commitSha: string;
  shortSha: string;
  commitSubject: string | null;
  committedAt: string | null;
  aiLinkStatus: AiLinkStatus;
  aiVerificationState: VerificationState;
  primaryWorkflowName: string | null;
  primaryWorkflowConclusion: string | null;
  deploymentStatus: string | null;
  regressionStatus: RegressionStatus | null;
  relatedPipelineCount: number;
}

export interface ChangeListResponse {
  changes: ChangeSummary[];
}

export type DependencyState = "ok" | "degraded";

/** Shape of `GET /api/v1/status/dependencies`. */
export interface DependencyStatus {
  status: DependencyState;
  checks: {
    database: DependencyState;
    github: DependencyState;
    signoz: DependencyState;
  };
}

export interface ReceiptEvidenceLink {
  kind: "signoz_trace" | "signoz_dashboard" | "github_run" | "deployment_trace" | "ai_trace";
  label: string;
  url: string;
  verificationState: "pending" | "verified" | "failed";
}

export interface ChangeReceipt {
  change: {
    commitSha: string;
    shortSha: string;
    commitSubject: string | null;
    committedAt: string | null;
    branch: string | null;
    aiLinkStatus: AiLinkStatus;
    aiVerificationState: VerificationState;
    aiTraceparent: string | null;
    aiSpanContext: SpanContext | null;
    githubUrl: string;
    changedFilesCount: number | null;
    additions: number | null;
    deletions: number | null;
  };
  /**
   * The coding session that produced the change, read back from its trace.
   *
   * Null when the change has no verified AI link, or when the trace store
   * could not be reached — an unanswered question, never an empty session.
   */
  aiSession: {
    sessionId: string | null;
    prompts: Array<{ at: string; text: string }>;
    /** False when the session ran with prompt export disabled. */
    promptsRecorded: boolean;
  } | null;
  pipeline: {
    workflowName: string;
    status: string;
    conclusion: string | null;
    durationMs: number | null;
    slowestStep: string | null;
    htmlUrl: string;
    signozTraceUrl: string | null;
    exportState: "pending" | "exported" | "verified" | "failed";
    isReconstructed: true;
  } | null;
  relatedPipelines: Array<{
    workflowName: string;
    status: string;
    conclusion: string | null;
    htmlUrl: string;
  }>;
  deployment: {
    id: string;
    serviceName: string;
    environmentName: string;
    version: string | null;
    role: string;
    status: string;
    deployedAt: string;
    imageDigest: string | null;
    versionState: "pending" | "verified" | "failed";
    traceState: "pending" | "exported" | "verified" | "failed";
  } | null;
  impact: {
    route: string;
    baselineVersion: string | null;
    observedVersion: string | null;
    baselineRequestCount: number | null;
    observedRequestCount: number | null;
    baselineP95Ms: number | null;
    observedP95Ms: number | null;
    baselineP90Ms: number | null;
    observedP90Ms: number | null;
    baselineErrorRate: number | null;
    observedErrorRate: number | null;
    status: RegressionStatus | null;
    reasons: string[];
    thresholds: {
      latencyMultiplier: number;
      latencyAdditiveMs: number;
      errorRateDeltaPct: number;
      errorRateAbsolutePct: number;
      minSpans: number;
    };
    correlationNote: string;
    baselineWindow: { start: string; end: string };
    observedWindow: { start: string; end: string };
    policyVersion: string;
  } | null;
  evidence: ReceiptEvidenceLink[];
  recovery: {
    deploymentId: string;
    version: string | null;
    deployedAt: string;
    status: RegressionStatus | null;
    observedP95Ms: number | null;
    observedErrorRate: number | null;
    imageDigest: string | null;
  } | null;
  actions: {
    revertCommand: string;
  };
  caveat: string;
}
