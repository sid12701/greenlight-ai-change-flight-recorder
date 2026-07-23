import { z } from "zod";

export const AppConfigSchema = z.object({
  GREENLIGHT_PORT: z.coerce.number().default(4000),
  GREENLIGHT_DATABASE_PATH: z.string().default("./data/greenlight.db"),
  GREENLIGHT_ADMIN_TOKEN: z.string().min(1),
  GITHUB_TOKEN: z.string().min(1),
  GITHUB_REPOSITORY: z.string().regex(/^[^/]+\/[^/]+$/),
  GREENLIGHT_PRIMARY_WORKFLOW_NAME: z.string().default("Backend CI"),
  SIGNOZ_URL: z.string().url().default("http://localhost:8080"),
  SIGNOZ_API_KEY: z.string().min(1),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default("http://localhost:4318"),
  OTEL_SERVICE_NAME: z.string().default("greenlight-api"),
  LMS_PATH: z.string().min(1),
  LMS_DEMO_BRANCH: z.string().default("greenlight-demo"),
  GREENLIGHT_BASELINE_WINDOW_SECONDS: z.coerce.number().default(90),
  GREENLIGHT_WARMUP_SECONDS: z.coerce.number().default(15),
  GREENLIGHT_OBSERVED_WINDOW_SECONDS: z.coerce.number().default(90),
  GREENLIGHT_MIN_SPANS: z.coerce.number().default(200),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = AppConfigSchema.safeParse(env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid configuration: ${fields}`);
  }
  return parsed.data;
}

export function redactSecrets(config: AppConfig) {
  return {
    ...config,
    GREENLIGHT_ADMIN_TOKEN: "[redacted]",
    GITHUB_TOKEN: "[redacted]",
    SIGNOZ_API_KEY: "[redacted]",
  };
}
