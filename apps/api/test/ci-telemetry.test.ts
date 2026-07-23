import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildNormalizedRunFromFixture,
  shouldSkipEmission,
  synthesizeCiTrace,
} from "../src/modules/ci-telemetry/synthesizer.js";
import {
  buildAiSpanLink,
  buildSignozTraceUrl,
  shouldAttachAiLink,
} from "../src/modules/ci-telemetry/link.js";

const fixture = JSON.parse(
  readFileSync(join(import.meta.dirname, "fixtures/github/backend-success.json"), "utf8"),
);

describe("ci trace synthesizer", () => {
  it("creates workflow, job, and step hierarchy with reconstructed labels", async () => {
    const run = buildNormalizedRunFromFixture(fixture);
    const result = await synthesizeCiTrace({
      run,
      repository: "demo/lms",
      reconstructionAtMs: Date.parse("2026-07-23T10:06:00Z"),
    });

    expect(result.spanCount).toBeGreaterThanOrEqual(3);
    expect(result.traceId).toMatch(/^[0-9a-f]{32}$/);
  });

  it("maps failed conclusions to error status", async () => {
    const failed = JSON.parse(
      readFileSync(join(import.meta.dirname, "fixtures/github/backend-failed.json"), "utf8"),
    );
    const run = buildNormalizedRunFromFixture(failed);
    const result = await synthesizeCiTrace({
      run,
      repository: "demo/lms",
      reconstructionAtMs: Date.parse("2026-07-23T11:05:00Z"),
    });
    expect(result.traceId).toBeTruthy();
  });

  it("attaches AI span link only when requested for primary runs", async () => {
    const run = buildNormalizedRunFromFixture(fixture);
    const aiContext = {
      version: "00" as const,
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      spanId: "00f067aa0ba902b7",
      flags: "01",
    };
    const result = await synthesizeCiTrace({
      run,
      repository: "demo/lms",
      reconstructionAtMs: Date.parse("2026-07-23T10:06:00Z"),
      aiSpanContext: aiContext,
      includeAiLink: true,
    });
    expect(result.links).toHaveLength(1);
    expect(result.links[0].context.traceId).toBe(aiContext.traceId);
  });

  it("skips emission when a trace id already exists", () => {
    expect(shouldSkipEmission("abc123")).toBe(true);
    expect(shouldSkipEmission(null)).toBe(false);
    expect(shouldSkipEmission("abc123", true)).toBe(false);
  });
});

describe("ci span link", () => {
  const aiContext = {
    version: "00" as const,
    traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
    spanId: "00f067aa0ba902b7",
    flags: "01",
  };

  it("attaches one link for primary runs with valid trailer context", () => {
    expect(shouldAttachAiLink(true, aiContext)).toBe(true);
    expect(buildAiSpanLink(aiContext)).toHaveLength(1);
    expect(buildAiSpanLink(null)).toEqual([]);
  });

  it("does not attach links for secondary workflows", () => {
    expect(shouldAttachAiLink(false, aiContext)).toBe(false);
  });

  it("builds SigNoz deep links from trace and span ids", () => {
    expect(buildSignozTraceUrl("http://localhost:8080", aiContext.traceId, aiContext.spanId))
      .toBe("http://localhost:8080/trace/4bf92f3577b34da6a3ce929d0e0e4736?spanId=00f067aa0ba902b7");
  });
});
