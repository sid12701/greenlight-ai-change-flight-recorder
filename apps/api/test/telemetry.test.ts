import { afterEach, describe, expect, it } from "vitest";
import {
  buildResource,
  redactSpanAttributes,
  sanitizeStackTrace,
} from "../src/telemetry.js";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("telemetry resource", () => {
  it("carries the identity every deployment-impact query filters on", () => {
    const resource = buildResource({
      endpoint: "http://localhost:4318",
      serviceName: "greenlight-worker",
      serviceVersion: "1.2.3",
      environmentName: "production",
    });
    expect(resource.attributes["service.name"]).toBe("greenlight-worker");
    expect(resource.attributes["service.version"]).toBe("1.2.3");
    expect(resource.attributes["deployment.environment.name"]).toBe("production");
  });
});

describe("telemetry redaction", () => {
  it("removes credential-bearing attributes", () => {
    const redacted = redactSpanAttributes({
      "http.request.header.authorization": "Bearer secret-value",
      "signoz.api_key": "key-value",
      "db.password": "hunter2",
      "http.route": "/api/v1/changes",
    });
    expect(redacted["http.request.header.authorization"]).toBe("[redacted]");
    expect(redacted["signoz.api_key"]).toBe("[redacted]");
    expect(redacted["db.password"]).toBe("[redacted]");
    expect(redacted["http.route"]).toBe("/api/v1/changes");
  });

  it("strips host paths from an exported stack trace", () => {
    const stack = [
      "ValidationError: commitSha: Required",
      "    at parseInput (file:///Users/alice/work/greenlight/apps/api/dist/http/schemas.js:69:15)",
      "    at handler (/home/deploy/greenlight/apps/api/dist/app.js:12:3)",
    ].join("\n");

    const sanitized = sanitizeStackTrace(stack, "/Users/alice/work/greenlight");

    expect(sanitized).toContain("ValidationError: commitSha: Required");
    expect(sanitized).not.toContain("/Users/alice");
    expect(sanitized).not.toContain("/home/deploy");
  });
});
