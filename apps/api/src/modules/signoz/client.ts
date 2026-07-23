import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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

export function computeErrorRatePercent(
  requestCount: number | null,
  errorCount: number | null,
): number | null {
  if (requestCount === null || errorCount === null || requestCount <= 0) {
    return null;
  }
  return (errorCount / requestCount) * 100;
}

export function parseTraceIds(payload: unknown, limit = 3): string[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const data = payload as {
    data?: {
      result?: Array<{
        table?: { records?: Array<{ data?: Record<string, string> }> };
        series?: Array<{ labels?: Record<string, string> }>;
      }>;
    };
  };

  const traceIds: string[] = [];
  for (const result of data.data?.result ?? []) {
    for (const record of result.table?.records ?? []) {
      const traceId =
        record.data?.traceID ??
        record.data?.traceId ??
        record.data?.trace_id ??
        record.data?.["trace.id"];
      if (traceId && !traceIds.includes(traceId)) {
        traceIds.push(traceId);
      }
    }
    for (const series of result.series ?? []) {
      const traceId = series.labels?.traceID ?? series.labels?.traceId ?? series.labels?.["trace.id"];
      if (traceId && !traceIds.includes(traceId)) {
        traceIds.push(traceId);
      }
    }
  }

  return traceIds.slice(0, limit);
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
      const [countPayload, p95Payload, errorCountPayload] = await Promise.all([
        this.queryRange(renderQueryTemplate("request-count.json", window)),
        this.queryRange(renderQueryTemplate("observed-p95.json", window)),
        this.queryRange(renderQueryTemplate("error-count.json", window)),
      ]);
      const requestCount = parseRequestCount(countPayload);
      const errorCount = parseRequestCount(errorCountPayload);
      const p95Ms = parseLatencyMs(p95Payload);
      return {
        requestCount,
        p90Ms: p95Ms,
        p95Ms,
        errorRate: computeErrorRatePercent(requestCount, errorCount),
      };
    } catch {
      return this.queryWindowViaClickHouse(window);
    }
  }

  private async queryClickHouse(sql: string): Promise<string> {
    const container =
      process.env.SIGNOZ_CLICKHOUSE_CONTAINER ?? "signoz-telemetrystore-clickhouse-0-0";
    const { stdout } = await execFileAsync("docker", [
      "exec",
      container,
      "clickhouse-client",
      "--query",
      sql,
    ]);
    return stdout.trim();
  }

  private async queryWindowViaClickHouse(window: QueryWindow): Promise<SignozQueryResult> {
    try {
      let result = await this.queryWindowSlice(window);
      if ((result.requestCount ?? 0) < 200) {
        result = await this.queryWindowSlice({
          ...window,
          startMs: Date.now() - 20 * 60 * 1000,
          endMs: Date.now(),
        });
      }
      return result;
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

  private async queryWindowSlice(window: QueryWindow): Promise<SignozQueryResult> {
    const filters = `
      resources_string['service.name'] = '${window.serviceName}'
      AND resources_string['service.version'] = '${window.serviceVersion}'
      AND attributes_string['http.route'] = '${window.route}'
      AND timestamp >= fromUnixTimestamp64Milli(${window.startMs})
      AND timestamp <= fromUnixTimestamp64Milli(${window.endMs})
    `;
    const [requestCountRaw, p95Raw, errorCountRaw] = await Promise.all([
      this.queryClickHouse(`SELECT count() FROM signoz_traces.distributed_signoz_index_v3 WHERE ${filters}`),
      this.queryClickHouse(
        `SELECT quantile(0.95)(duration_nano) / 1000000 FROM signoz_traces.distributed_signoz_index_v3 WHERE ${filters}`,
      ),
      this.queryClickHouse(
        `SELECT countIf(status_code = 2) FROM signoz_traces.distributed_signoz_index_v3 WHERE ${filters}`,
      ),
    ]);
    const requestCount = Number(requestCountRaw);
    const errorCount = Number(errorCountRaw);
    const p95Ms = Number(p95Raw);
    return {
      requestCount: Number.isFinite(requestCount) ? Math.round(requestCount) : null,
      p90Ms: Number.isFinite(p95Ms) ? p95Ms : null,
      p95Ms: Number.isFinite(p95Ms) ? p95Ms : null,
      errorRate: computeErrorRatePercent(
        Number.isFinite(requestCount) ? Math.round(requestCount) : null,
        Number.isFinite(errorCount) ? Math.round(errorCount) : null,
      ),
    };
  }

  async querySlowTraces(window: QueryWindow, limit = 3): Promise<string[]> {
    try {
      const payload = await this.queryRange(renderQueryTemplate("slow-traces.json", window));
      const traceIds = parseTraceIds(payload, limit);
      if (traceIds.length >= limit) {
        return traceIds;
      }
    } catch {
      // fall through to ClickHouse
    }
    try {
      const output = await this.queryClickHouse(`
        SELECT trace_id FROM (
          SELECT trace_id, max(duration_nano) AS max_duration
          FROM signoz_traces.distributed_signoz_index_v3
          WHERE resources_string['service.name'] = '${window.serviceName}'
            AND resources_string['service.version'] = '${window.serviceVersion}'
            AND timestamp >= fromUnixTimestamp64Milli(${window.startMs})
            AND timestamp <= fromUnixTimestamp64Milli(${window.endMs})
          GROUP BY trace_id
          ORDER BY max_duration DESC
          LIMIT ${limit}
        )
      `);
      return output.split("\n").map((line) => line.trim()).filter(Boolean);
    } catch {
      return [];
    }
  }

  buildDashboardUrl(window: QueryWindow) {
    const url = new URL("/dashboard/deployment-impact", this.baseUrl);
    url.searchParams.set("service", window.serviceName);
    url.searchParams.set("version", window.serviceVersion);
    url.searchParams.set("route", window.route);
    return url.toString();
  }

  buildTraceUrl(traceId: string) {
    return new URL(`/trace/${traceId}`, this.baseUrl).toString();
  }
}
