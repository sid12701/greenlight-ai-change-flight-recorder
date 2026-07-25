import type { ChangeReceipt } from "@greenlight/shared";
import {
  TONE_CLASS,
  conclusionPresentation,
  deploymentPresentation,
  regressionPresentation,
  verificationPresentation,
  type StatusPresentation,
} from "../../status";

interface TimelineStage {
  name: string;
  status: StatusPresentation;
  /**
   * A secondary fact that qualifies the stage without changing what it
   * concluded. Kept separate from `status` so a detail about the evidence can
   * never be read as the outcome — a CI run that passed while its reconstructed
   * trace is still pending has passed.
   */
  note?: string;
}

/**
 * Describes how far the reconstructed CI trace got.
 *
 * Reported as a note rather than as the stage's status: whether GreenLight
 * managed to export and confirm a span tree says nothing about whether the
 * pipeline itself succeeded.
 */
function ciTelemetryNote(pipeline: ChangeReceipt["pipeline"]): string | undefined {
  if (!pipeline) {
    return undefined;
  }
  switch (pipeline.exportState) {
    case "verified":
      return "trace verified in SigNoz";
    case "exported":
      return "trace exported, not yet confirmed";
    case "pending":
      return "trace not exported yet";
    case "failed":
      return "trace could not be confirmed in SigNoz";
  }
}

function stagesFor(receipt: ChangeReceipt): TimelineStage[] {
  const deployment = receipt.deployment;
  return [
    {
      name: "AI session",
      status: verificationPresentation(receipt.change.aiVerificationState),
    },
    {
      name: "Commit",
      status: {
        label: receipt.change.shortSha,
        tone: "neutral",
        meaning: `Commit ${receipt.change.shortSha} on ${receipt.change.branch ?? "an unrecorded branch"}`,
      },
    },
    {
      name: "CI",
      status: conclusionPresentation(receipt.pipeline?.conclusion ?? null),
      note: ciTelemetryNote(receipt.pipeline),
    },
    {
      name: "Deploy",
      status: deploymentPresentation(deployment?.status ?? null),
      note: deployment ? `version evidence ${deployment.versionState}` : undefined,
    },
    {
      name: "Impact",
      status: regressionPresentation(receipt.impact?.status ?? null),
    },
    {
      name: "Recovery",
      status: regressionPresentation(receipt.recovery?.status ?? null),
    },
  ];
}

export function EvidenceTimeline({ receipt }: { receipt: ChangeReceipt }) {
  return (
    <section aria-label="Evidence timeline" className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="mb-4 text-xl font-semibold">Timeline</h2>
      <ol className="grid gap-3 md:grid-cols-3">
        {stagesFor(receipt).map((stage) => (
          <li key={stage.name} className="rounded-lg bg-slate-950 p-3 text-sm">
            <p className="font-medium">{stage.name}</p>
            <p
              className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium ${TONE_CLASS[stage.status.tone]}`}
              title={stage.status.meaning}
            >
              <span className="sr-only">{stage.name}: </span>
              {stage.status.label}
              <span className="sr-only"> — {stage.status.meaning}</span>
            </p>
            {stage.note ? <p className="mt-1 text-xs text-slate-500">{stage.note}</p> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
