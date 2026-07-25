import type { ChangeReceipt } from "@greenlight/shared";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bot,
  GitCommitHorizontal,
  Rocket,
  RotateCcw,
  Workflow,
} from "lucide-react";
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
  icon: LucideIcon;
  status: StatusPresentation;
  note?: string;
}

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
      icon: Bot,
      status: verificationPresentation(receipt.change.aiVerificationState),
    },
    {
      name: "Commit",
      icon: GitCommitHorizontal,
      status: {
        label: receipt.change.shortSha,
        tone: "neutral",
        meaning: `Commit ${receipt.change.shortSha} on ${receipt.change.branch ?? "an unrecorded branch"}`,
      },
    },
    {
      name: "CI",
      icon: Workflow,
      status: conclusionPresentation(receipt.pipeline?.conclusion ?? null),
      note: ciTelemetryNote(receipt.pipeline),
    },
    {
      name: "Deploy",
      icon: Rocket,
      status: deploymentPresentation(deployment?.status ?? null),
      note: deployment ? `Version evidence ${deployment.versionState}` : undefined,
    },
    {
      name: "Impact",
      icon: Activity,
      status: regressionPresentation(receipt.impact?.status ?? null),
    },
    {
      name: "Recovery",
      icon: RotateCcw,
      status: regressionPresentation(receipt.recovery?.status ?? null),
    },
  ];
}

export function EvidenceTimeline({ receipt }: { receipt: ChangeReceipt }) {
  return (
    <section aria-label="Evidence timeline" className="receipt-section timeline-section">
      <div className="section-heading-row">
        <div>
          <p className="section-kicker">End-to-end lineage</p>
          <h2>Evidence timeline</h2>
        </div>
        <span className="timeline-count">6 checkpoints</span>
      </div>
      <ol className="timeline-track">
        {stagesFor(receipt).map((stage, index) => {
          const Icon = stage.icon;
          return (
            <li key={stage.name} className={`timeline-stage timeline-stage--${stage.status.tone}`}>
              <span className="timeline-index">0{index + 1}</span>
              <span className="timeline-icon" aria-hidden="true">
                <Icon size={18} />
              </span>
              <div>
                <p>{stage.name}</p>
                <span
                  className={`status-chip ${TONE_CLASS[stage.status.tone]}`}
                  title={stage.status.meaning}
                >
                  <span className="sr-only">{stage.name}: </span>
                  {stage.status.label}
                  <span className="sr-only"> — {stage.status.meaning}</span>
                </span>
                {stage.note ? <small>{stage.note}</small> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
