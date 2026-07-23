import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const queriesDir = join(dirname(fileURLToPath(import.meta.url)), "../../../../../signoz/queries");

export interface QueryWindow {
  serviceName: string;
  serviceVersion: string;
  environmentName: string;
  route: string;
  startMs: number;
  endMs: number;
}

export class SignozIntegrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignozIntegrationError";
  }
}

function loadTemplate(name: string) {
  return readFileSync(join(queriesDir, name), "utf8");
}

export function renderQueryTemplate(templateName: string, window: QueryWindow) {
  return loadTemplate(templateName)
    .replaceAll("{{serviceName}}", window.serviceName)
    .replaceAll("{{serviceVersion}}", window.serviceVersion)
    .replaceAll("{{environmentName}}", window.environmentName)
    .replaceAll("{{route}}", window.route)
    .replaceAll("{{startMs}}", String(window.startMs))
    .replaceAll("{{endMs}}", String(window.endMs));
}

export interface SignozSeriesPoint {
  timestamp: number;
  value: number | null;
}

export interface SignozQueryResult {
  requestCount: number | null;
  p90Ms: number | null;
  p95Ms: number | null;
  errorRate: number | null;
  integrationError?: string;
}

export function parseScalarSeries(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const data = payload as { data?: { result?: Array<{ series?: Array<{ values?: Array<{ value: string }> }> }> } };
  const values = data.data?.result?.[0]?.series?.[0]?.values;
  if (!values?.length) {
    return null;
  }
  const numeric = Number(values.at(-1)?.value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function parseRequestCount(payload: unknown): number | null {
  const value = parseScalarSeries(payload);
  return value === null ? null : Math.round(value);
}

export function parseLatencyMs(payload: unknown): number | null {
  const nanos = parseScalarSeries(payload);
  return nanos === null ? null : nanos / 1_000_000;
}

export class SignozClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async queryRange(body: string): Promise<unknown> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await this.fetchImpl(`${this.baseUrl}/api/v5/query_range`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "SIGNOZ-API-KEY": this.apiKey,
          },
          body,
          signal: AbortSignal.timeout(10_000),
        });
        if (response.status === 429 || response.status >= 500) {
          lastError = new SignozIntegrationError(`SigNoz query failed with ${response.status}`);
          continue;
        }
        if (!response.ok) {
          throw new SignozIntegrationError(`SigNoz query failed with ${response.status}`);
        }
        return response.json();
      } catch (error) {
        lastError = error instanceof Error ? error : new SignozIntegrationError("SigNoz query failed");
        if (attempt === 0) {
          continue;
        }
      }
    }
    throw lastError ?? new SignozIntegrationError("SigNoz query failed");
  }

  async queryWindow(window: QueryWindow): Promise<SignozQueryResult> {
    try {
      const [countPayload, p95Payload] = await Promise.all([
        this.queryRange(renderQueryTemplate("error-rate.json", window)),
        this.queryRange(renderQueryTemplate("baseline-p95.json", window)),
      ]);
      const requestCount = parseRequestCount(countPayload);
      const p95Ms = parseLatencyMs(p95Payload);
      return {
        requestCount,
        p90Ms: p95Ms,
        p95Ms,
        errorRate: null,
      };
    } catch (error) {
      return {
        requestCount: null,
        p90Ms: null,
        p95Ms: null,
        errorRate: null,
        integrationError: error instanceof Error ? error.message : "integration_error",
      };
    }
  }

  buildDashboardUrl(window: QueryWindow) {
    const url = new URL("/dashboard/deployment-impact", this.baseUrl);
    url.searchParams.set("service", window.serviceName);
    url.searchParams.set("version", window.serviceVersion);
    url.searchParams.set("route", window.route);
    return url.toString();
  }
}
