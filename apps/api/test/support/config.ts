import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AppConfigSchema, type AppConfig } from "../../src/config.js";

/**
 * Builds a valid `AppConfig` through the real schema.
 *
 * Going through the schema means a test can never assert against a config
 * shape that production would reject, and new required settings surface as a
 * test failure instead of silently defaulting.
 */
export function testConfig(overrides: Record<string, string> = {}): AppConfig {
  return AppConfigSchema.parse({
    GREENLIGHT_ENV: "test",
    GREENLIGHT_ADMIN_TOKEN: "test-admin-token-0123456789",
    GITHUB_TOKEN: "test-github-token",
    GITHUB_REPOSITORY: "demo/lms",
    SIGNOZ_API_KEY: "test-signoz-key",
    GREENLIGHT_ALLOWED_ORIGINS: "http://127.0.0.1:4173",
    GREENLIGHT_HEALTH_ALLOWED_ORIGINS: "http://lms.test:9081",
    ...overrides,
  });
}

/**
 * Creates an isolated on-disk database directory.
 *
 * Tests must never write into the workspace: a stray database there is both a
 * source of cross-test coupling and something a careless `git add` commits.
 */
export function temporaryDatabase(): { path: string; cleanup: () => void } {
  const directory = mkdtempSync(join(tmpdir(), "greenlight-test-"));
  return {
    path: join(directory, "greenlight.db"),
    cleanup: () => rmSync(directory, { recursive: true, force: true }),
  };
}
