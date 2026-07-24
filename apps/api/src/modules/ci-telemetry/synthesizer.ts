import {
  context,
  trace,
  type Link,
  type SpanContext as OtelSpanContext,
} from "@opentelemetry/api";
import {
  BasicTracerProvider,
  BatchSpanProcessor,
  InMemorySpanExporter,
  type SpanExporter,
} from "@opentelemetry/sdk-trace-base";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import type { SpanContext } from "@greenlight/shared";
import {
  findSlowestStep,
  normalizeWorkflowRun,
  type NormalizedWorkflowRun,
} from "../github/normalize.js";

export interface SynthesizerInput {
  run: NormalizedWorkflowRun;
  repository: string;
  reconstructionAtMs: number;
  aiSpanContext?: SpanContext | null;
  includeAiLink?: boolean;
}

export interface SynthesizerResult {
  traceId: string;
  rootSpanId: string;
  spanCount: number;
  links: Link[];
}

function isErrorConclusion(conclusion: string | null): boolean {
  return conclusion === "failure" || conclusion === "cancelled" || conclusion === "timed_out";
}

function toOtelContext(spanContext: SpanContext): OtelSpanContext {
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    traceFlags: Number.parseInt(spanContext.flags, 16),
    isRemote: true,
  };
}

export function createCiTelemetryProvider(exporter: SpanExporter) {
  const provider = new BasicTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: "greenlight-ci",
      "greenlight.telemetry.origin": "reconstructed",
    }),
    spanProcessors: [new BatchSpanProcessor(exporter)],
  });
  return provider;
}

export async function synthesizeCiTrace(
  input: SynthesizerInput,
  exporter?: SpanExporter,
): Promise<SynthesizerResult> {
  const provider = createCiTelemetryProvider(exporter ?? new InMemorySpanExporter());
  const tracer = provider.getTracer("greenlight-ci-synthesizer");
  const links: Link[] = [];

  if (input.includeAiLink && input.aiSpanContext) {
    links.push({ context: toOtelContext(input.aiSpanContext) });
  }

  const rootSpan = tracer.startSpan(
    `Reconstructed GitHub Actions: ${input.run.workflowName}`,
    {
      startTime: input.run.startedAtMs ?? undefined,
      links,
      attributes: {
        "vcs.ref.head.revision": input.run.headSha,
        "vcs.repository.name": input.repository,
        "cicd.pipeline.name": input.run.workflowName,
        "cicd.pipeline.run.id": input.run.providerRunId,
        "ci.provider": "github",
        "greenlight.telemetry.origin": "reconstructed",
        "greenlight.telemetry.source": "github_rest_api",
        "greenlight.github.run_id": input.run.providerRunId,
        "greenlight.reconstructed_at": new Date(input.reconstructionAtMs).toISOString(),
      },
    },
  );
  const rootSpanContext = rootSpan.spanContext();

  const rootContext = trace.setSpan(context.active(), rootSpan);

  for (const job of input.run.jobs) {
    const jobSpan = tracer.startSpan(
      `job:${job.name}`,
      {
        startTime: job.startedAtMs ?? undefined,
        attributes: {
          "cicd.pipeline.run.id": input.run.providerRunId,
          "cicd.pipeline.task.name": job.name,
          "github.job.id": String(job.id),
          "github.job.conclusion": job.conclusion ?? "unknown",
        },
      },
      rootContext,
    );

    const jobContext = trace.setSpan(rootContext, jobSpan);

    for (const step of job.steps) {
      const stepSpan = tracer.startSpan(
        `step:${step.name}`,
        {
          startTime: step.startedAtMs ?? undefined,
          attributes: {
            "github.step.name": step.name,
            "github.step.number": step.number,
            "github.step.conclusion": step.conclusion ?? "unknown",
          },
        },
        jobContext,
      );

      if (isErrorConclusion(step.conclusion)) {
        stepSpan.setStatus({ code: 2, message: step.conclusion ?? "error" });
      }
      stepSpan.end(step.completedAtMs ?? undefined);
    }

    if (isErrorConclusion(job.conclusion)) {
      jobSpan.setStatus({ code: 2, message: job.conclusion ?? "error" });
    }
    jobSpan.end(job.completedAtMs ?? undefined);
  }

  if (isErrorConclusion(input.run.conclusion)) {
    rootSpan.setStatus({ code: 2, message: input.run.conclusion ?? "error" });
  }

  rootSpan.end(input.run.completedAtMs ?? undefined);

  try {
    await provider.forceFlush();
  } finally {
    await provider.shutdown();
  }

  return {
    traceId: rootSpanContext.traceId,
    rootSpanId: rootSpanContext.spanId,
    spanCount: 1 + input.run.jobs.reduce(
      (count, job) => count + 1 + job.steps.length,
      0,
    ),
    links,
  };
}

export function buildNormalizedRunFromFixture(fixture: {
  workflowRun: Parameters<typeof normalizeWorkflowRun>[0];
  jobs: { jobs: Parameters<typeof normalizeWorkflowRun>[1] };
}) {
  return normalizeWorkflowRun(fixture.workflowRun, fixture.jobs.jobs);
}

export { findSlowestStep };
