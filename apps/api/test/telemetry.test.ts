import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { trace } from "@opentelemetry/api";
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { afterEach, describe, expect, it } from "vitest";
import { buildServer } from "../src/app.js";
import { testConfig } from "./support/config.js";
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

describe("route attribution", () => {
  const cleanups: Array<() => Promise<void> | void> = [];
  afterEach(async () => {
    while (cleanups.length) {
      await cleanups.pop()?.();
    }
  });

  async function setup() {
    const exporter = new InMemorySpanExporter();
    const provider = new NodeTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    });
    // The OTel API ignores a second `setGlobalTracerProvider` call, so each
    // case must clear the previous registration or it exports into the
    // first case's exporter.
    trace.disable();
    trace.setGlobalTracerProvider(provider);

    const directory = mkdtempSync(join(tmpdir(), "greenlight-route-"));
    const config = testConfig({ GREENLIGHT_DATABASE_PATH: join(directory, "test.db") });
    const app = await buildServer(config);

    cleanups.push(async () => {
      await app.close();
      await provider.shutdown();
      trace.disable();
      rmSync(directory, { recursive: true, force: true });
    });
    return { app, exporter };
  }

  // Without this, every API span is named `GET` with no `http.route`, so the
  // SigNoz "API requests by route" panel groups everything into one empty
  // series and the service map has no operations to show.
  it("records the matched route on the request span", async () => {
    const { app, exporter } = await setup();

    const response = await app.inject({ method: "GET", url: "/api/v1/changes" });
    expect(response.statusCode).toBe(200);

    const spans = exporter.getFinishedSpans();
    const requestSpan = spans.find((span) => span.attributes["url.path"] === "/api/v1/changes");
    expect(requestSpan, `no request span was recorded; saw ${JSON.stringify(
      spans.map((span) => ({ name: span.name, route: span.attributes["http.route"] })),
    )}`).toBeDefined();
    expect(requestSpan?.attributes["http.route"]).toBe("/api/v1/changes");
    expect(requestSpan?.attributes["http.request.method"]).toBe("GET");
    expect(requestSpan?.attributes["http.response.status_code"]).toBe(200);
  });

  it("reports the route template rather than the concrete path", async () => {
    const { app, exporter } = await setup();
    const commitSha = "c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2";

    await app.inject({ method: "GET", url: `/api/v1/changes/${commitSha}` });

    const routes = exporter
      .getFinishedSpans()
      .map((span) => span.attributes["http.route"])
      .filter(Boolean);
    // A per-commit route would make every request its own series and blow up
    // dashboard cardinality.
    expect(routes).toContain("/api/v1/changes/:commitSha");
    expect(routes.some((route) => String(route).includes(commitSha))).toBe(false);
  });

  it("does not trace readiness probes", async () => {
    const { app, exporter } = await setup();

    await app.inject({ method: "GET", url: "/readyz" });
    await app.inject({ method: "GET", url: "/livez" });

    const routes = exporter
      .getFinishedSpans()
      .map((span) => span.attributes["http.route"]);
    expect(routes).not.toContain("/readyz");
    expect(routes).not.toContain("/livez");
  });
});
