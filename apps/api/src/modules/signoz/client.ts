/**
 * The only supported path from GreenLight to SigNoz.
 *
 * Every method distinguishes three outcomes, because an evidence product must
 * never present "the dependency failed" as "the evidence is absent":
 *
 * - a value, when SigNoz answered;
 * - an explicit absence (`null` / `false` / `[]`), when SigNoz answered that
 *   nothing matched;
 * - a thrown `SignozIntegrationError`, when SigNoz could not be reached,
 *   rejected the credential, or returned a response we do not recognise.
 */
import {
  buildAiSessionPromptsRequest,
  buildCredentialProbeRequest,
  buildSlowTraceRequest,
  buildSpanSessionRequest,
  buildTraceVerificationRequest,
  buildWindowMetricsRequest,
  nanosecondsToMilliseconds,
  readGroupValues,
  readRawColumn,
  readRawRows,
  readScalarAggregation,
  sumScalarAggregation,
  type QueryRangeRequest,
  type QueryWindow,
} from "./query.js";

export type { QueryWindow, TelemetryScope } from "./query.js";
export { QueryWindowSchema } from "./query.js";

export class SignozIntegrationError extends Error {
  constructor(
    message: string,
    readonly code:
      | "signoz_unauthorized"
      | "signoz_unavailable"
      | "signoz_invalid_request"
      | "signoz_invalid_response" = "signoz_unavailable",
    readonly retryable = true,
  ) {
    super(message);
    this.name = "SignozIntegrationError";
  }
}

export interface WindowMetrics {
  requestCount: number | null;
  errorCount: number | null;
  p90Ms: number | null;
  p95Ms: number | null;
  errorRatePercent: number | null;
}

export interface TraceVerification {
  spanCount: number;
  services: string[];
  spanPresent: boolean | null;
}

export interface SignozClientOptions {
  fetchImpl?: typeof fetch;
  sleepImpl?: (milliseconds: number) => Promise<void>;
  randomImpl?: () => number;
  nowImpl?: () => number;
  deploymentDashboardId?: string;
  /**
   * Origin used to build links a reader will open, when it differs from the
   * origin this process queries. Defaults to the query origin.
   */
  publicBaseUrl?: string;
  /** Total attempts per request, including the first. */
  maxAttempts?: number;
  requestTimeoutMs?: number;
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export function computeErrorRatePercent(
  requestCount: number | null,
  errorCount: number | null,
): number | null {
  if (requestCount === null || errorCount === null || requestCount <= 0) {
    return null;
  }
  return (errorCount / requestCount) * 100;
}

export class SignozClient {
  private readonly fetchImpl: typeof fetch;
  private readonly sleepImpl: (milliseconds: number) => Promise<void>;
  private readonly randomImpl: () => number;
  private readonly nowImpl: () => number;
  private readonly maxAttempts: number;
  private readonly requestTimeoutMs: number;
  /**
   * Origin for links handed to a reader, which is not always the origin used to
   * query. Held separately from `baseUrl` so a link can never inherit a
   * container-internal host by omission.
   */
  private readonly publicBaseUrl: string;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly options: SignozClientOptions = {},
  ) {
    this.publicBaseUrl = options.publicBaseUrl ?? baseUrl;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleepImpl = options.sleepImpl ??
      ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.randomImpl = options.randomImpl ?? Math.random;
    this.nowImpl = options.nowImpl ?? Date.now;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 10_000;
  }

  private backoffMs(attempt: number, retryAfterHeader: string | null): number {
    const retryAfterSeconds = retryAfterHeader === null ? Number.NaN : Number(retryAfterHeader);
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
      return Math.min(retryAfterSeconds * 1_000, 10_000);
    }
    const exponential = Math.min(250 * 2 ** attempt, 2_000);
    return exponential + Math.floor(this.randomImpl() * 100);
  }

  async queryRange(request: QueryRangeRequest): Promise<unknown> {
    const body = JSON.stringify(request);
    let lastError = new SignozIntegrationError("SigNoz query was never attempted");

    for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetchImpl(new URL("/api/v5/query_range", this.baseUrl), {
          method: "POST",
          headers: { "Content-Type": "application/json", "SIGNOZ-API-KEY": this.apiKey },
          body,
          signal: AbortSignal.timeout(this.requestTimeoutMs),
        });
      } catch (error) {
        lastError = new SignozIntegrationError(
          `SigNoz request failed: ${error instanceof Error ? error.message : "unknown transport error"}`,
        );
        if (attempt < this.maxAttempts - 1) {
          await this.sleepImpl(this.backoffMs(attempt, null));
        }
        continue;
      }

      if (response.status === 401 || response.status === 403) {
        throw new SignozIntegrationError(
          `SigNoz rejected the configured API key (HTTP ${response.status})`,
          "signoz_unauthorized",
          false,
        );
      }
      if (response.status === 400 || response.status === 422) {
        throw new SignozIntegrationError(
          `SigNoz rejected the query as invalid (HTTP ${response.status})`,
          "signoz_invalid_request",
          false,
        );
      }
      if (RETRYABLE_STATUS.has(response.status)) {
        lastError = new SignozIntegrationError(`SigNoz returned HTTP ${response.status}`);
        if (attempt < this.maxAttempts - 1) {
          await this.sleepImpl(this.backoffMs(attempt, response.headers.get("retry-after")));
        }
        continue;
      }
      if (!response.ok) {
        throw new SignozIntegrationError(
          `SigNoz returned HTTP ${response.status}`,
          "signoz_unavailable",
          false,
        );
      }

      try {
        return await response.json();
      } catch {
        throw new SignozIntegrationError(
          "SigNoz returned a body that is not valid JSON",
          "signoz_invalid_response",
          false,
        );
      }
    }

    throw lastError;
  }

  /**
   * Request count, p90, p95 and error rate for one immutable window.
   *
   * `null` fields mean SigNoz reported no matching spans. Callers must treat
   * that as `insufficient_data`, never as zero.
   */
  async queryWindow(window: QueryWindow): Promise<WindowMetrics> {
    const payload = await this.queryRange(buildWindowMetricsRequest(window));
    const rawCount = readScalarAggregation(payload, "A", 0);
    const p90Nanos = readScalarAggregation(payload, "A", 1);
    const p95Nanos = readScalarAggregation(payload, "A", 2);
    // A zero count with no percentiles means the window matched nothing at
    // all. Reporting that as "0 requests" invites a caller to treat it as a
    // measurement; it is an absence, and every field must say so.
    const requestCount = rawCount === 0 && p95Nanos === null ? null : rawCount;
    // SigNoz omits the row entirely when no error spans matched; for a window
    // that did serve traffic, that is a genuine zero rather than missing data.
    const errorCount = readScalarAggregation(payload, "B", 0) ?? (requestCount === null ? null : 0);
    return {
      requestCount: requestCount === null ? null : Math.round(requestCount),
      errorCount: errorCount === null ? null : Math.round(errorCount),
      p90Ms: nanosecondsToMilliseconds(p90Nanos),
      p95Ms: nanosecondsToMilliseconds(p95Nanos),
      errorRatePercent: computeErrorRatePercent(requestCount, errorCount),
    };
  }

  async querySlowTraceIds(window: QueryWindow, limit = 3): Promise<string[]> {
    const payload = await this.queryRange(buildSlowTraceRequest(window, limit));
    return readRawColumn(payload, "A", "trace_id").slice(0, limit);
  }

  /**
   * Resolves a trace in SigNoz. Returns the observed shape so callers can
   * apply their own expectations; a missing trace yields `spanCount: 0`.
   */
  async describeTrace(input: {
    traceId: string;
    spanId?: string;
    startMs: number;
    endMs: number;
  }): Promise<TraceVerification> {
    const payload = await this.queryRange(buildTraceVerificationRequest(input));
    return {
      spanCount: sumScalarAggregation(payload, "A"),
      services: readGroupValues(payload, "A"),
      spanPresent: input.spanId === undefined
        ? null
        : sumScalarAggregation(payload, "B") > 0,
    };
  }

  /**
   * Returns the prompts recorded by one coding session, oldest first.
   *
   * Prompt export is opt-in (`OTEL_LOG_USER_PROMPTS`), so an empty result is
   * the ordinary answer for a session recorded while it was off, and is
   * reported as such rather than as an error. Only the trace named by the
   * commit is read, so this cannot surface a different session's prompts.
   */
  async fetchAiSessionPrompts(input: {
    traceId: string;
    spanId: string;
    serviceName: string;
    startMs: number;
    endMs: number;
    limit?: number;
  }): Promise<{ sessionId: string | null; prompts: Array<{ at: string; text: string }> }> {
    // Resolve the session from the span the commit names before reading any
    // prompt. Sessions nest, so the trace alone does not identify one.
    const ownerPayload = await this.queryRange(buildSpanSessionRequest({
      traceId: input.traceId,
      spanId: input.spanId,
      startMs: input.startMs,
      endMs: input.endMs,
    }));
    const owner = readRawRows(ownerPayload, "A")[0]?.["session.id"];
    if (typeof owner !== "string" || owner.length === 0) {
      return { sessionId: null, prompts: [] };
    }

    const payload = await this.queryRange(buildAiSessionPromptsRequest({
      sessionId: owner,
      serviceName: input.serviceName,
      startMs: input.startMs,
      endMs: input.endMs,
      limit: input.limit ?? 50,
    }));
    const prompts: Array<{ at: string; text: string }> = [];
    for (const row of readRawRows(payload, "A")) {
      const text = row.user_prompt;
      const at = row.timestamp;
      // `<REDACTED>` is what Claude Code writes when prompt export is off. It
      // is a placeholder, not a prompt, and presenting it as one would imply
      // the session recorded something it deliberately did not.
      if (typeof text !== "string" || text.length === 0 || text === "<REDACTED>") {
        continue;
      }
      prompts.push({ at: typeof at === "string" ? at : "", text });
    }
    // The session is named by the span the commit points at, so it is reported
    // even when that session recorded no prompt text.
    return { sessionId: owner, prompts };
  }

  /**
   * True only when the trace resolves and satisfies every stated expectation.
   * Integration failures propagate so that "SigNoz is down" is never recorded
   * as "the trace does not exist".
   */
  async verifyTrace(input: {
    traceId: string;
    spanId?: string;
    expectedServiceName?: string;
    expectedSpanCount?: number;
    startMs: number;
    endMs: number;
  }): Promise<boolean> {
    const trace = await this.describeTrace(input);
    if (trace.spanCount < (input.expectedSpanCount ?? 1)) {
      return false;
    }
    if (input.spanId !== undefined && trace.spanPresent !== true) {
      return false;
    }
    if (input.expectedServiceName !== undefined && !trace.services.includes(input.expectedServiceName)) {
      return false;
    }
    return true;
  }

  /** True when the exact deployed version is producing spans on the route. */
  async isVersionVisible(window: QueryWindow): Promise<boolean> {
    const metrics = await this.queryWindow(window);
    return metrics.requestCount !== null && metrics.requestCount > 0;
  }

  /**
   * Exercises the credentialed query path. A liveness probe that skips
   * authentication would report a healthy dependency while every real query
   * returns 401.
   */
  async checkHealth(): Promise<boolean> {
    const probe = new SignozClient(this.baseUrl, this.apiKey, {
      ...this.options,
      maxAttempts: 1,
      requestTimeoutMs: Math.min(this.requestTimeoutMs, 5_000),
    });
    try {
      await probe.queryRange(buildCredentialProbeRequest(this.nowImpl()));
      return true;
    } catch {
      return false;
    }
  }

  buildDashboardUrl(window: QueryWindow): string | null {
    const dashboardId = this.options.deploymentDashboardId;
    if (!dashboardId) {
      return null;
    }
    const url = new URL(`/dashboard/${encodeURIComponent(dashboardId)}`, this.publicBaseUrl);
    url.searchParams.set("service", window.serviceName);
    url.searchParams.set("version", window.serviceVersion);
    url.searchParams.set("environment", window.environmentName);
    url.searchParams.set("route", window.route);
    return url.toString();
  }

  buildTraceUrl(traceId: string): string {
    if (!/^[0-9a-f]{32}$/i.test(traceId)) {
      throw new SignozIntegrationError(
        "Refusing to build a trace URL for a malformed trace ID",
        "signoz_invalid_response",
        false,
      );
    }
    return new URL(`/trace/${traceId.toLowerCase()}`, this.publicBaseUrl).toString();
  }
}
