import { describe, expect, it } from "vitest";
import { loadConfig, redactSecrets } from "../src/config.js";

const required = {
  GREENLIGHT_ADMIN_TOKEN: "strong-admin-token-value",
  GITHUB_TOKEN: "strong-github-token-value",
  GITHUB_REPOSITORY: "demo/lms",
  SIGNOZ_API_KEY: "strong-signoz-token-value",
};

describe("configuration safety", () => {
  it("rejects production without authenticated reads and PostgreSQL", () => {
    expect(() => loadConfig({
      ...required,
      GREENLIGHT_ENV: "production",
    })).toThrow(/Invalid configuration/);
  });

  it("allows anonymous public GitHub reads only outside production", () => {
    expect(() => loadConfig({
      ...required,
      GITHUB_TOKEN: "",
    })).not.toThrow();
    expect(() => loadConfig({
      ...required,
      GITHUB_TOKEN: "",
      GREENLIGHT_ENV: "production",
      GREENLIGHT_DATABASE_URL: "postgresql://db.example.test/greenlight",
      GREENLIGHT_REQUIRE_READ_AUTH: "true",
      GREENLIGHT_ADMIN_TOKEN: undefined,
      GREENLIGHT_API_KEYS: JSON.stringify([
        { id: "reader", key: "reader-token-with-safe-length", scopes: ["read"] },
      ]),
    })).toThrow(/GITHUB_TOKEN/);
  });

  it("rejects placeholder production secrets", () => {
    expect(() => loadConfig({
      ...required,
      GREENLIGHT_ENV: "production",
      GREENLIGHT_DATABASE_URL: "postgresql://db.example.test/greenlight",
      GREENLIGHT_REQUIRE_READ_AUTH: "true",
      GREENLIGHT_ADMIN_TOKEN: "replace-locally",
    })).toThrow(/Invalid configuration/);
  });

  it("redacts every configured credential set", () => {
    const config = loadConfig({
      ...required,
      GREENLIGHT_API_KEYS: JSON.stringify([
        { id: "reader", key: "reader-token-with-safe-length", scopes: ["read"] },
      ]),
    });
    expect(redactSecrets(config)).toMatchObject({
      GREENLIGHT_ADMIN_TOKEN: "[redacted]",
      GREENLIGHT_API_KEYS: "[redacted]",
      GITHUB_TOKEN: "[redacted]",
      SIGNOZ_API_KEY: "[redacted]",
    });
  });

  it("rejects non-HTTP and path-bearing health-check origins", () => {
    expect(() => loadConfig({
      ...required,
      GREENLIGHT_HEALTH_ALLOWED_ORIGINS: "file:///etc/passwd",
    })).toThrow(/Invalid configuration/);
    expect(() => loadConfig({
      ...required,
      GREENLIGHT_HEALTH_ALLOWED_ORIGINS: "https://lms.example.test/health",
    })).toThrow(/Invalid configuration/);
  });
});
