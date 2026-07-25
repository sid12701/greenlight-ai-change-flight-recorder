import { z } from "zod";
import type {
  ChangeListResponse,
  ChangeReceipt,
  DependencyStatus,
} from "./contracts.js";

const NullableNumber = z.number().finite().nullable();
const RegressionStatusSchema = z.enum([
  "insufficient_data",
  "integration_error",
  "healthy",
  "regressed",
  "recovered",
]);
const VerificationStateSchema = z.enum([
  "missing",
  "invalid",
  "unverified",
  "verified",
  "failed",
]);

export const ChangeListResponseSchema: z.ZodType<ChangeListResponse> = z.object({
  changes: z.array(z.object({
    commitSha: z.string().regex(/^[0-9a-f]{40}$/i),
    shortSha: z.string(),
    commitSubject: z.string().nullable(),
    committedAt: z.string().nullable(),
    aiLinkStatus: z.enum(["linked", "missing", "invalid"]),
    aiVerificationState: VerificationStateSchema,
    primaryWorkflowName: z.string().nullable(),
    primaryWorkflowConclusion: z.string().nullable(),
    deploymentStatus: z.string().nullable(),
    regressionStatus: RegressionStatusSchema.nullable(),
    relatedPipelineCount: z.number().int().nonnegative(),
  })),
});

const DependencyStateSchema = z.enum(["ok", "degraded"]);

export const DependencyStatusSchema: z.ZodType<DependencyStatus> = z.object({
  status: DependencyStateSchema,
  checks: z.object({
    database: DependencyStateSchema,
    github: DependencyStateSchema,
    signoz: DependencyStateSchema,
  }),
});

export const ChangeReceiptSchema: z.ZodType<ChangeReceipt> = z.object({
  change: z.object({
    commitSha: z.string().regex(/^[0-9a-f]{40}$/i),
    shortSha: z.string(),
    commitSubject: z.string().nullable(),
    committedAt: z.string().nullable(),
    branch: z.string().nullable(),
    aiLinkStatus: z.enum(["linked", "missing", "invalid"]),
    aiVerificationState: VerificationStateSchema,
    aiTraceparent: z.string().nullable(),
    aiSpanContext: z.object({
      version: z.literal("00"),
      traceId: z.string().regex(/^[0-9a-f]{32}$/),
      spanId: z.string().regex(/^[0-9a-f]{16}$/),
      flags: z.string().regex(/^[0-9a-f]{2}$/),
    }).nullable(),
    githubUrl: z.string().url(),
    changedFilesCount: NullableNumber,
    additions: NullableNumber,
    deletions: NullableNumber,
  }),
  pipeline: z.object({
    workflowName: z.string(),
    status: z.string(),
    conclusion: z.string().nullable(),
    durationMs: NullableNumber,
    slowestStep: z.string().nullable(),
    htmlUrl: z.string().url(),
    signozTraceUrl: z.string().url().nullable(),
    exportState: z.enum(["pending", "exported", "verified", "failed"]),
    isReconstructed: z.literal(true),
  }).nullable(),
  relatedPipelines: z.array(z.object({
    workflowName: z.string(),
    status: z.string(),
    conclusion: z.string().nullable(),
    htmlUrl: z.string().url(),
  })),
  deployment: z.object({
    id: z.string(),
    serviceName: z.string(),
    environmentName: z.string(),
    version: z.string().nullable(),
    role: z.string(),
    status: z.string(),
    deployedAt: z.string(),
    imageDigest: z.string().nullable(),
    versionState: z.enum(["pending", "verified", "failed"]),
    traceState: z.enum(["pending", "exported", "verified", "failed"]),
  }).nullable(),
  impact: z.object({
    route: z.string(),
    baselineVersion: z.string().nullable(),
    observedVersion: z.string().nullable(),
    baselineRequestCount: NullableNumber,
    observedRequestCount: NullableNumber,
    baselineP95Ms: NullableNumber,
    observedP95Ms: NullableNumber,
    baselineP90Ms: NullableNumber,
    observedP90Ms: NullableNumber,
    baselineErrorRate: NullableNumber,
    observedErrorRate: NullableNumber,
    status: RegressionStatusSchema.nullable(),
    reasons: z.array(z.string()),
    thresholds: z.object({
      latencyMultiplier: z.number(),
      latencyAdditiveMs: z.number(),
      errorRateDeltaPct: z.number(),
      errorRateAbsolutePct: z.number(),
      minSpans: z.number().int(),
    }),
    correlationNote: z.string(),
    baselineWindow: z.object({ start: z.string(), end: z.string() }),
    observedWindow: z.object({ start: z.string(), end: z.string() }),
    policyVersion: z.string(),
  }).nullable(),
  evidence: z.array(z.object({
    kind: z.enum(["signoz_trace", "signoz_dashboard", "github_run", "deployment_trace", "ai_trace"]),
    label: z.string(),
    url: z.string().url(),
    verificationState: z.enum(["pending", "verified", "failed"]),
  })),
  recovery: z.object({
    deploymentId: z.string(),
    version: z.string().nullable(),
    deployedAt: z.string(),
    status: RegressionStatusSchema.nullable(),
    observedP95Ms: NullableNumber,
    observedErrorRate: NullableNumber,
    imageDigest: z.string().nullable(),
  }).nullable(),
  actions: z.object({ revertCommand: z.string() }),
  caveat: z.string(),
});
