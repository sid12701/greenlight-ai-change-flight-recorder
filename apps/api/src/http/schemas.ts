import { z } from "zod";
import { ValidationError } from "./errors.js";

export const CommitShaSchema = z.string().regex(/^[0-9a-f]{40}$/i, "Expected a full 40-character Git SHA");
export const RepositorySchema = z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
export const RouteSchema = z.string().min(1).max(512).regex(/^\/(?!\/)/);
export const IsoDateTimeSchema = z.string().datetime({ offset: true });
export const EntityIdSchema = z.string().min(3).max(200).regex(/^[A-Za-z0-9_.:-]+$/);
export const WorkflowNameSchema = z.string().min(1).max(255);
const HttpUrlSchema = z.string().url().superRefine((value, context) => {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Expected an HTTP(S) URL without embedded credentials",
    });
  }
});

export const CommitShaParamsSchema = z.object({
  commitSha: CommitShaSchema,
}).strict();

export const SyncRunsBodySchema = z.object({
  repository: RepositorySchema.optional(),
  runIds: z.array(z.number().int().positive()).min(1).max(100),
  primaryWorkflowName: WorkflowNameSchema.optional(),
}).strict();

export const SyncLatestBodySchema = z.object({
  repository: RepositorySchema.optional(),
  branch: z.string().min(1).max(255).optional(),
  primaryWorkflowName: WorkflowNameSchema.optional(),
  /** How many recent commits to re-walk; bounded so one call cannot sync the repo. */
  limit: z.number().int().min(1).max(50).optional(),
}).strict();

export const DeploymentBodySchema = z.object({
  repository: RepositorySchema,
  commitSha: CommitShaSchema,
  serviceName: z.string().min(1).max(255),
  environmentName: z.string().min(1).max(255),
  route: RouteSchema,
  healthUrl: HttpUrlSchema,
  imageDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/i),
  idempotencyKey: z.string().min(8).max(255),
  provider: z.string().min(1).max(64).default("api"),
  role: z.enum(["baseline", "candidate", "recovery"]),
  status: z.enum(["started", "succeeded", "failed"]),
  deployedAt: IsoDateTimeSchema,
  /**
   * Retire the active baseline and make this one the baseline new comparisons
   * resolve to.
   *
   * Opt-in, because re-baselining changes what every future verdict is measured
   * against. Without it a second baseline is still refused, so an accidental
   * repeat cannot silently move the reference point.
   */
  supersedeBaseline: z.boolean().optional(),
}).strict();

export const EvaluationBodySchema = z.object({
  deploymentId: EntityIdSchema,
  baselineDeploymentId: EntityIdSchema.optional(),
  incidentId: EntityIdSchema.optional(),
  route: RouteSchema,
  comparisonKind: z.enum(["deployment", "recovery"]).optional(),
}).strict().superRefine((value, context) => {
  if (value.comparisonKind === "recovery" && !value.incidentId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["incidentId"],
      message: "Recovery evaluation requires an explicit incidentId",
    });
  }
});

export const JobParamsSchema = z.object({
  jobId: EntityIdSchema,
}).strict();

/**
 * The Alertmanager-shaped payload SigNoz posts to a webhook channel.
 *
 * Deliberately permissive about fields GreenLight does not read: this is a
 * third party's envelope, and rejecting a notification because SigNoz added a
 * field would lose the alert rather than record it. Only what is read is
 * constrained.
 */
export const SignozAlertNotificationSchema = z.object({
  alerts: z.array(z.object({
    status: z.string().min(1).max(64).default("firing"),
    labels: z.record(z.string(), z.string()).default({}),
    annotations: z.record(z.string(), z.string()).default({}),
    startsAt: z.string().max(64).optional(),
    endsAt: z.string().max(64).optional(),
    generatorURL: z.string().max(2048).optional(),
  }).passthrough()).max(100),
}).passthrough();

export function parseInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  value: unknown,
): z.output<TSchema> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`)
      .join("; ");
    throw new ValidationError(details);
  }
  return result.data as z.output<TSchema>;
}
