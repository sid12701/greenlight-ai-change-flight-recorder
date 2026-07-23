import type { SpanContext } from "./traceparent.js";

export type AiLinkStatus = "linked" | "missing" | "invalid";
export type RegressionStatus =
  | "insufficient_data"
  | "healthy"
  | "regressed"
  | "recovered";

export interface ChangeSummary {
  commitSha: string;
  shortSha: string;
  commitSubject: string | null;
  committedAt: string | null;
  aiLinkStatus: AiLinkStatus;
  primaryWorkflowName: string | null;
  primaryWorkflowConclusion: string | null;
  deploymentStatus: string | null;
  regressionStatus: RegressionStatus | null;
  relatedPipelineCount: number;
}

export interface ChangeListResponse {
  changes: ChangeSummary[];
}

export interface ReceiptEvidenceLink {
  kind: "signoz_trace" | "signoz_dashboard";
  label: string;
  url: string;
}

export interface ChangeReceipt {
  change: {
    commitSha: string;
    shortSha: string;
    commitSubject: string | null;
    committedAt: string | null;
    branch: string | null;
    aiLinkStatus: AiLinkStatus;
    aiTraceparent: string | null;
    aiSpanContext: SpanContext | null;
    githubUrl: string;
    changedFilesCount: number | null;
    additions: number | null;
    deletions: number | null;
  };
  pipeline: {
    workflowName: string;
    status: string;
    conclusion: string | null;
    durationMs: number | null;
    slowestStep: string | null;
    htmlUrl: string;
    signozTraceUrl: string | null;
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
    version: string;
    role: string;
    status: string;
    deployedAt: string;
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
  } | null;
  evidence: ReceiptEvidenceLink[];
  recovery: {
    deploymentId: string;
    version: string;
    deployedAt: string;
    status: RegressionStatus | null;
    observedP95Ms: number | null;
    observedErrorRate: number | null;
  } | null;
  actions: {
    revertCommand: string;
  };
  caveat: string;
}
