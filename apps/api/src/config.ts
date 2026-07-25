import { z } from "zod";

const PositiveInteger = z.coerce.number().int().positive();
const NonNegativeInteger = z.coerce.number().int().nonnegative();

/**
 * Environment variables are strings, and `Boolean("false")` is `true`.
 * Booleans are therefore parsed from an explicit vocabulary so that a
 * deployment which sets `false` gets `false`, and a typo is rejected instead
 * of silently enabling the feature.
 */
const BooleanFlag = (defaultValue: boolean) =>
  z
    .enum(["true", "false", "1", "0", "yes", "no"])
    .default(defaultValue ? "true" : "false")
    .transform((value) => value === "true" || value === "1" || value === "yes");

const CommaSeparatedOrigins = z.string().transform((value) =>
  value.split(",").map((entry) => entry.trim()).filter((entry) => entry.length > 0),
);

const PLACEHOLDER_SECRET = /replace|change-?me|example|placeholder|^test$|^local-/i;

function isHttpOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      url.origin === value &&
      !url.username &&
      !url.password;
  } catch {
    return false;
  }
}

export const ApiKeySchema = z.object({
  id: z.string().min(1),
  key: z.string().min(24),
  scopes: z.array(z.enum(["read", "sync", "deploy", "evaluate", "admin"])).min(1),
});

export type ApiKey = z.infer<typeof ApiKeySchema>;

export const AppConfigSchema = z.object({
  GREENLIGHT_ENV: z.enum(["development", "test", "production"]).default("development"),
  GREENLIGHT_PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  GREENLIGHT_HOST: z.string().default("127.0.0.1"),
  GREENLIGHT_SERVICE_VERSION: z.string().min(1).default("0.1.0"),
  GREENLIGHT_DATABASE_PATH: z.string().default("./data/greenlight.db"),
  GREENLIGHT_DATABASE_URL: z.string().url().optional(),
  GREENLIGHT_ADMIN_TOKEN: z.string().min(24).optional(),
  GREENLIGHT_API_KEYS: z.string().default("[]"),
  GREENLIGHT_REQUIRE_READ_AUTH: BooleanFlag(false),
  GREENLIGHT_ALLOWED_ORIGINS: CommaSeparatedOrigins.default(
    "http://127.0.0.1:4173,http://localhost:4173",
  ),
  GREENLIGHT_HEALTH_ALLOWED_ORIGINS: CommaSeparatedOrigins.default(
    "http://127.0.0.1:8081,http://127.0.0.1:8082",
  ),
  GREENLIGHT_BODY_LIMIT_BYTES: PositiveInteger.default(1_048_576),
  GREENLIGHT_REQUEST_TIMEOUT_MS: PositiveInteger.default(15_000),
  GREENLIGHT_RATE_LIMIT_PER_MINUTE: PositiveInteger.default(120),
  GREENLIGHT_MAX_CONCURRENT_REQUESTS: PositiveInteger.default(50),
  GITHUB_TOKEN: z.string().default(""),
  GITHUB_REPOSITORY: z.string().regex(/^[^/]+\/[^/]+$/),
  GREENLIGHT_PRIMARY_WORKFLOW_NAME: z.string().default("Backend CI"),
  GREENLIGHT_PRIMARY_WORKFLOW_ID: z.coerce.number().int().positive().optional(),
  SIGNOZ_URL: z.string().url().default("http://localhost:8080"),
  SIGNOZ_API_KEY: z.string().min(1),
  SIGNOZ_MCP_URL: z.string().url().default("http://localhost:8000/mcp"),
  SIGNOZ_DEPLOYMENT_DASHBOARD_ID: z.string().min(1).optional(),
  SIGNOZ_QUERY_TIMEOUT_MS: PositiveInteger.default(10_000),
  SIGNOZ_QUERY_MAX_ATTEMPTS: PositiveInteger.max(10).default(3),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default("http://localhost:4318"),
  OTEL_SERVICE_NAME: z.string().default("greenlight-api"),
  CLAUDE_OTEL_SERVICE_NAME: z.string().default("claude-code"),
  GREENLIGHT_DEMO_BRANCH: z.string().default("main"),
  GREENLIGHT_BASELINE_WINDOW_SECONDS: PositiveInteger.default(90),
  GREENLIGHT_WARMUP_SECONDS: NonNegativeInteger.default(15),
  GREENLIGHT_OBSERVED_WINDOW_SECONDS: PositiveInteger.default(90),
  GREENLIGHT_INGESTION_DELAY_SECONDS: NonNegativeInteger.default(15),
  GREENLIGHT_MIN_SPANS: PositiveInteger.default(200),
  GREENLIGHT_VERSION_VISIBILITY_TIMEOUT_MS: PositiveInteger.default(30_000),
  GREENLIGHT_JOB_MAX_ATTEMPTS: PositiveInteger.max(20).default(5),
  GREENLIGHT_JOB_DEADLINE_MS: PositiveInteger.default(120_000),
  GREENLIGHT_LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
}).superRefine((config, context) => {
  const addIssue = (path: string, message: string) => {
    context.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
  };

  for (const field of ["GREENLIGHT_ALLOWED_ORIGINS", "GREENLIGHT_HEALTH_ALLOWED_ORIGINS"] as const) {
    for (const origin of config[field]) {
      if (!isHttpOrigin(origin)) {
        addIssue(field, `Invalid HTTP origin: ${origin}`);
      }
    }
  }

  let apiKeys: ApiKey[] = [];
  try {
    apiKeys = z.array(ApiKeySchema).parse(JSON.parse(config.GREENLIGHT_API_KEYS));
  } catch {
    addIssue("GREENLIGHT_API_KEYS", "Must be a JSON array of scoped API keys");
  }

  if (config.GREENLIGHT_ENV !== "production") {
    return;
  }

  if (!config.GREENLIGHT_DATABASE_URL) {
    addIssue(
      "GREENLIGHT_DATABASE_URL",
      "PostgreSQL is required in production; the local file store cannot be shared between the API and the worker",
    );
  }
  if (!config.GREENLIGHT_REQUIRE_READ_AUTH) {
    addIssue("GREENLIGHT_REQUIRE_READ_AUTH", "Read authentication is required in production");
  }
  // The static admin token grants every scope and cannot be rotated or
  // revoked per consumer. Production must use scoped keys only.
  if (config.GREENLIGHT_ADMIN_TOKEN) {
    addIssue(
      "GREENLIGHT_ADMIN_TOKEN",
      "The static admin token is a local-development fallback and must not be set in production; issue scoped GREENLIGHT_API_KEYS instead",
    );
  }
  if (apiKeys.length === 0) {
    addIssue("GREENLIGHT_API_KEYS", "At least one scoped API key is required in production");
  }
  for (const [field, value] of [
    ["GITHUB_TOKEN", config.GITHUB_TOKEN],
    ["SIGNOZ_API_KEY", config.SIGNOZ_API_KEY],
  ] as const) {
    if (!value || PLACEHOLDER_SECRET.test(value)) {
      addIssue(field, "Placeholder secrets are forbidden in production");
    }
  }
  for (const key of apiKeys) {
    if (PLACEHOLDER_SECRET.test(key.key)) {
      addIssue("GREENLIGHT_API_KEYS", `API key "${key.id}" uses a placeholder secret`);
    }
  }
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = AppConfigSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "config"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid configuration: ${details}`);
  }
  if (!parsed.data.GREENLIGHT_ADMIN_TOKEN && parsed.data.GREENLIGHT_API_KEYS === "[]") {
    throw new Error(
      "Invalid configuration: set GREENLIGHT_ADMIN_TOKEN (local development) or GREENLIGHT_API_KEYS (any shared environment)",
    );
  }
  return parsed.data;
}

export function parseApiKeys(config: AppConfig): ApiKey[] {
  return z.array(ApiKeySchema).parse(JSON.parse(config.GREENLIGHT_API_KEYS));
}

const REDACTED = "[redacted]";

/** Config shape safe to log or attach to telemetry. */
export function redactSecrets(config: AppConfig) {
  return {
    ...config,
    GREENLIGHT_ADMIN_TOKEN: config.GREENLIGHT_ADMIN_TOKEN ? REDACTED : undefined,
    GREENLIGHT_API_KEYS: REDACTED,
    GITHUB_TOKEN: REDACTED,
    SIGNOZ_API_KEY: REDACTED,
  };
}
