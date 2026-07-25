/**
 * GreenLight's own metrics.
 *
 * These describe what the product decided and how healthy it is, which traces
 * alone cannot answer: a verdict is a decision rather than a request, and
 * queue depth and dependency availability are states rather than events.
 *
 * Nothing here derives a metric from a metric. Each instrument is recorded at
 * the point the fact becomes true, so a counter can always be traced back to a
 * persisted row.
 */
import { metrics, ValueType } from "@opentelemetry/api";

const METER_NAME = "greenlight";

function meter() {
  return metrics.getMeter(METER_NAME);
}

/**
 * Instruments are created lazily and cached. Creating them at module load
 * would bind them to whichever meter provider existed at import time, which is
 * the no-op provider when telemetry starts after the module graph is built.
 */
let verdictCounter: ReturnType<ReturnType<typeof meter>["createCounter"]> | undefined;
let verificationCounter: ReturnType<ReturnType<typeof meter>["createCounter"]> | undefined;
let alertNotificationCounter: ReturnType<ReturnType<typeof meter>["createCounter"]> | undefined;

/** Records a persisted regression verdict. */
export function recordRegressionVerdict(input: {
  status: string;
  comparisonKind: string;
  route: string;
}): void {
  verdictCounter ??= meter().createCounter("greenlight.regression.verdicts", {
    description: "Regression evaluations by decided status",
    valueType: ValueType.INT,
  });
  verdictCounter.add(1, {
    status: input.status,
    comparison_kind: input.comparisonKind,
    route: input.route,
  });
}

/** Records the AI-link state a change was stored with. */
export function recordAiVerificationState(state: string): void {
  verificationCounter ??= meter().createCounter("greenlight.change.ai_verification", {
    description: "Changes recorded by AI verification state",
    valueType: ValueType.INT,
  });
  verificationCounter.add(1, { state });
}

/**
 * Records an alert notification SigNoz delivered to GreenLight.
 *
 * Counted here rather than inferred from SigNoz's own rule state, because the
 * two answer different questions: SigNoz knows whether a rule is firing, and
 * this knows whether the notification reached the system that is supposed to
 * act on it. A rule that fires into a broken channel looks healthy from inside
 * SigNoz.
 */
export function recordAlertNotification(input: { alertName: string; status: string }): void {
  alertNotificationCounter ??= meter().createCounter("greenlight.alerts.notifications", {
    description: "SigNoz alert notifications received, by rule and status",
    valueType: ValueType.INT,
  });
  alertNotificationCounter.add(1, { alert: input.alertName, status: input.status });
}

export interface RuntimeMetricSources {
  /** Pending and in-flight job counts, keyed by job state. */
  countJobsByState: () => Promise<Record<string, number>>;
  /** Availability of each external dependency, keyed by dependency name. */
  checkDependencies: () => Promise<Record<string, boolean>>;
}

/**
 * Registers the state gauges.
 *
 * These are observed on the export interval rather than pushed, because a
 * queue depth or a dependency state is only meaningful as "what is true now",
 * and pushing on change would report nothing while the system is idle —
 * exactly when an operator most wants to see that it is still healthy.
 */
export function registerRuntimeMetrics(sources: RuntimeMetricSources): void {
  const queueDepth = meter().createObservableGauge("greenlight.jobs.queue_depth", {
    description: "Jobs currently held in each state",
    valueType: ValueType.INT,
  });
  queueDepth.addCallback(async (result) => {
    const counts = await sources.countJobsByState();
    for (const [state, count] of Object.entries(counts)) {
      result.observe(count, { state });
    }
  });

  const dependencyUp = meter().createObservableGauge("greenlight.dependency.available", {
    description: "Whether each external dependency answered its health check",
    valueType: ValueType.INT,
  });
  dependencyUp.addCallback(async (result) => {
    const checks = await sources.checkDependencies();
    for (const [dependency, healthy] of Object.entries(checks)) {
      result.observe(healthy ? 1 : 0, { dependency });
    }
  });
}
