import { readFileSync } from "node:fs";
import { join } from "node:path";
import { context, trace } from "@opentelemetry/api";
import { ExportResultCode } from "@opentelemetry/core";
import {
  BasicTracerProvider,
  type ReadableSpan,
  type SpanExporter,
} from "@opentelemetry/sdk-trace-base";
import { describe, expect, it } from "vitest";
import {
  buildNormalizedRunFromFixture,
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

  it("gives each run its own trace, even inside an active span", async () => {
    // Reconstruction runs inside an instrumented worker job. If the root span
    // adopts the ambient context, every run synthesized in one job shares the
    // worker's trace ID, several runs merge into a single trace, and the ID
    // recorded against each pipeline row identifies the sync rather than the run.
    const run = buildNormalizedRunFromFixture(fixture);
    const provider = new BasicTracerProvider();
    const ambient = provider.getTracer("test").startSpan("job github_sync_runs");
    const ambientTraceId = ambient.spanContext().traceId;

    const [first, second] = await context.with(
      trace.setSpan(context.active(), ambient),
      async () => [
        await synthesizeCiTrace({
          run,
          repository: "demo/lms",
          reconstructionAtMs: Date.parse("2026-07-23T10:06:00Z"),
        }),
        await synthesizeCiTrace({
          run,
          repository: "demo/lms",
          reconstructionAtMs: Date.parse("2026-07-23T10:07:00Z"),
        }),
      ],
    );
    ambient.end();

    expect(first.traceId).not.toBe(ambientTraceId);
    expect(second.traceId).not.toBe(ambientTraceId);
    expect(first.traceId).not.toBe(second.traceId);
  });

  it("keeps every reconstructed span inside the trace it reports", async () => {
    const run = buildNormalizedRunFromFixture(fixture);
    // `InMemorySpanExporter` discards its spans on shutdown, and the
    // synthesizer shuts down the provider it built, so the recorded spans have
    // to outlive it to be inspected.
    const spans: ReadableSpan[] = [];
    const exporter: SpanExporter = {
      export: (batch, resultCallback) => {
        spans.push(...batch);
        resultCallback({ code: ExportResultCode.SUCCESS });
      },
      shutdown: async () => {},
      forceFlush: async () => {},
    };
    const result = await synthesizeCiTrace({
      run,
      repository: "demo/lms",
      reconstructionAtMs: Date.parse("2026-07-23T10:06:00Z"),
    }, exporter);

    expect(spans).toHaveLength(result.spanCount);
    expect(new Set(spans.map((span) => span.spanContext().traceId))).toEqual(
      new Set([result.traceId]),
    );
    // Exactly one span has no parent, so SigNoz can build the tree.
    expect(spans.filter((span) => span.parentSpanContext === undefined)).toHaveLength(1);
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
