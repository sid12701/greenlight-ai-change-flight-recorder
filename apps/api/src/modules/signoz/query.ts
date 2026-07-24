/**
 * Request and response contracts for the SigNoz v5 query API
 * (`POST /api/v5/query_range`).
 *
 * Requests are built as typed objects rather than rendered from string
 * templates so that a filter value can never alter query structure, and
 * responses are parsed through Zod so that an upstream schema change fails
 * loudly instead of silently yielding `null` metrics.
 */
import { z } from "zod";

export const SIGNOZ_SCHEMA_VERSION = "v1";

export class SignozQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignozQueryError";
  }
}

/** Attribute keys are identifiers; only a known-safe alphabet is accepted. */
const FILTER_KEY = /^[A-Za-z_][A-Za-z0-9_.]*$/;

export interface TelemetryScope {
  serviceName: string;
  serviceVersion: string;
  environmentName: string;
  route: string;
}

export interface QueryWindow extends TelemetryScope {
  /** Inclusive window start, epoch milliseconds. */
  startMs: number;
  /** Exclusive window end, epoch milliseconds. */
  endMs: number;
}

export const TelemetryScopeSchema = z.object({
  serviceName: z.string().min(1).max(255).regex(/^[A-Za-z0-9._:-]+$/),
  serviceVersion: z.string().min(1).max(255).regex(/^[A-Za-z0-9._:-]+$/),
  environmentName: z.string().min(1).max(255).regex(/^[A-Za-z0-9._:-]+$/),
  route: z.string().min(1).max(512).regex(/^\/[A-Za-z0-9/_{}.:~-]*$/),
});

export const QueryWindowSchema = TelemetryScopeSchema.extend({
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive(),
}).refine((window) => window.endMs > window.startMs, {
  message: "Query window end must be after start",
});

export const TraceIdSchema = z.string().regex(/^[0-9a-f]{32}$/i);
export const SpanIdSchema = z.string().regex(/^[0-9a-f]{16}$/i);

/**
 * Escapes a value for use inside a single-quoted SigNoz filter expression.
 *
 * Callers must still validate values against a schema; this is the second
 * layer of defence, not the first.
 */
export function quoteFilterValue(value: string): string {
  // eslint-disable-next-line no-control-regex -- control characters are exactly what must be rejected
  if (/[\u0000-\u001f]/.test(value)) {
    throw new SignozQueryError("Filter values must not contain control characters");
  }
  return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
}

export function equalsFilter(key: string, value: string): string {
  if (!FILTER_KEY.test(key)) {
    throw new SignozQueryError(`Unsupported filter key: ${key}`);
  }
  return `${key} = ${quoteFilterValue(value)}`;
}

export function scopeFilter(scope: TelemetryScope): string {
  return [
    equalsFilter("service.name", scope.serviceName),
    equalsFilter("service.version", scope.serviceVersion),
    equalsFilter("deployment.environment.name", scope.environmentName),
    equalsFilter("http.route", scope.route),
  ].join(" AND ");
}

export interface BuilderQuerySpec {
  name: string;
  signal: "traces" | "logs" | "metrics";
  disabled: boolean;
  filter?: { expression: string };
  aggregations?: Array<{ expression: string }>;
  groupBy?: Array<{ name: string; fieldDataType: string; fieldContext: string }>;
  selectFields?: Array<{ name: string }>;
  order?: Array<{ key: { name: string }; direction: "asc" | "desc" }>;
  limit?: number;
}

export interface QueryRangeRequest {
  schemaVersion: typeof SIGNOZ_SCHEMA_VERSION;
  start: number;
  end: number;
  requestType: "scalar" | "raw" | "time_series";
  compositeQuery: { queries: Array<{ type: "builder_query"; spec: BuilderQuerySpec }> };
}

function request(
  requestType: QueryRangeRequest["requestType"],
  startMs: number,
  endMs: number,
  specs: BuilderQuerySpec[],
): QueryRangeRequest {
  return {
    schemaVersion: SIGNOZ_SCHEMA_VERSION,
    start: startMs,
    end: endMs,
    requestType,
    compositeQuery: { queries: specs.map((spec) => ({ type: "builder_query", spec })) },
  };
}

/**
 * Window metrics in a single round trip: query `A` yields request count, p90
 * and p95 for the scope; query `B` yields the error count for the same scope.
 */
export function buildWindowMetricsRequest(window: QueryWindow): QueryRangeRequest {
  const validated = QueryWindowSchema.parse(window);
  const scope = scopeFilter(validated);
  return request("scalar", validated.startMs, validated.endMs, [
    {
      name: "A",
      signal: "traces",
      disabled: false,
      filter: { expression: scope },
      aggregations: [
        { expression: "count()" },
        { expression: "p90(duration_nano)" },
        { expression: "p95(duration_nano)" },
      ],
    },
    {
      name: "B",
      signal: "traces",
      disabled: false,
      filter: { expression: `${scope} AND has_error = true` },
      aggregations: [{ expression: "count()" }],
    },
  ]);
}

export function buildSlowTraceRequest(window: QueryWindow, limit: number): QueryRangeRequest {
  const validated = QueryWindowSchema.parse(window);
  return request("raw", validated.startMs, validated.endMs, [
    {
      name: "A",
      signal: "traces",
      disabled: false,
      filter: { expression: scopeFilter(validated) },
      selectFields: [{ name: "trace_id" }, { name: "duration_nano" }],
      order: [{ key: { name: "duration_nano" }, direction: "desc" }],
      limit,
    },
  ]);
}

/**
 * Trace verification in a single round trip: query `A` counts spans per
 * service for the trace; query `B` (present only when a specific span is
 * required) counts occurrences of that span.
 */
export function buildTraceVerificationRequest(input: {
  traceId: string;
  spanId?: string;
  startMs: number;
  endMs: number;
}): QueryRangeRequest {
  const traceId = TraceIdSchema.parse(input.traceId).toLowerCase();
  if (!Number.isInteger(input.startMs) || !Number.isInteger(input.endMs)) {
    throw new SignozQueryError("Trace verification window must use integer milliseconds");
  }
  if (input.endMs <= input.startMs) {
    throw new SignozQueryError("Trace verification window end must be after start");
  }
  const traceFilter = equalsFilter("trace_id", traceId);
  const specs: BuilderQuerySpec[] = [
    {
      name: "A",
      signal: "traces",
      disabled: false,
      filter: { expression: traceFilter },
      aggregations: [{ expression: "count()" }],
      groupBy: [{ name: "service.name", fieldDataType: "string", fieldContext: "resource" }],
    },
  ];
  if (input.spanId !== undefined) {
    const spanId = SpanIdSchema.parse(input.spanId).toLowerCase();
    specs.push({
      name: "B",
      signal: "traces",
      disabled: false,
      filter: { expression: `${traceFilter} AND ${equalsFilter("span_id", spanId)}` },
      aggregations: [{ expression: "count()" }],
    });
  }
  return request("scalar", input.startMs, input.endMs, specs);
}

/** Minimal authenticated request used to prove the API key is accepted. */
export function buildCredentialProbeRequest(nowMs: number): QueryRangeRequest {
  return request("scalar", nowMs - 60_000, nowMs, [
    { name: "A", signal: "traces", disabled: false, aggregations: [{ expression: "count()" }] },
  ]);
}

const ScalarResultSchema = z.object({
  queryName: z.string(),
  columns: z.array(z.object({ name: z.string() })).nullable().optional(),
  data: z.array(z.array(z.union([z.number(), z.string(), z.null()]))).default([]),
});

const RawResultSchema = z.object({
  queryName: z.string(),
  rows: z.array(z.object({ data: z.record(z.string(), z.unknown()) })).default([]),
});

const ScalarResponseSchema = z.object({
  data: z.object({
    data: z.object({ results: z.array(ScalarResultSchema).default([]) }),
  }),
});

const RawResponseSchema = z.object({
  data: z.object({
    data: z.object({ results: z.array(RawResultSchema).default([]) }),
  }),
});

/**
 * Reads aggregation slot `index` of a scalar query.
 *
 * Returns `null` only when SigNoz reports no rows for the window, which is a
 * genuine "no data" answer and must stay distinguishable from a transport or
 * schema failure (those throw).
 */
export function readScalarAggregation(
  payload: unknown,
  queryName: string,
  index = 0,
): number | null {
  const parsed = ScalarResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new SignozQueryError("SigNoz returned an unrecognised scalar response");
  }
  const result = parsed.data.data.data.results.find((entry) => entry.queryName === queryName);
  if (!result || result.data.length === 0) {
    return null;
  }
  const row = result.data[0];
  const columns = result.columns ?? [];
  const aggregationColumns = columns.length
    ? columns
      .map((column, position) => ({ name: column.name, position }))
      .filter((column) => column.name.startsWith("__result_"))
    : row.map((_value, position) => ({ name: `__result_${position}`, position }));
  const column = aggregationColumns[index];
  if (!column) {
    return null;
  }
  const raw = row[column.position];
  // SigNoz answers an empty window with a zero count and null percentiles.
  // `Number(null)` is 0, which would turn "no latency was measured" into
  // "latency was zero" — a window with no traffic would then read as a
  // dramatic improvement over its baseline.
  if (raw === null || raw === undefined || raw === "") {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Sums the grouped counts of a scalar query across every group. */
export function sumScalarAggregation(payload: unknown, queryName: string): number {
  const parsed = ScalarResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new SignozQueryError("SigNoz returned an unrecognised scalar response");
  }
  const result = parsed.data.data.data.results.find((entry) => entry.queryName === queryName);
  if (!result) {
    return 0;
  }
  return result.data.reduce((total, row) => {
    const value = Number(row.at(-1));
    return Number.isFinite(value) ? total + value : total;
  }, 0);
}

/** Collects the distinct values of a grouping column across every group. */
export function readGroupValues(payload: unknown, queryName: string): string[] {
  const parsed = ScalarResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new SignozQueryError("SigNoz returned an unrecognised scalar response");
  }
  const result = parsed.data.data.data.results.find((entry) => entry.queryName === queryName);
  if (!result) {
    return [];
  }
  const values = new Set<string>();
  for (const row of result.data) {
    const value = row[0];
    if (typeof value === "string" && value.length > 0) {
      values.add(value);
    }
  }
  return [...values];
}

export function readRawColumn(payload: unknown, queryName: string, column: string): string[] {
  const parsed = RawResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new SignozQueryError("SigNoz returned an unrecognised raw response");
  }
  const result = parsed.data.data.data.results.find((entry) => entry.queryName === queryName);
  if (!result) {
    return [];
  }
  const values: string[] = [];
  for (const row of result.rows) {
    const value = row.data[column];
    if (typeof value === "string" && value.length > 0 && !values.includes(value)) {
      values.push(value);
    }
  }
  return values;
}

export function nanosecondsToMilliseconds(value: number | null): number | null {
  return value === null ? null : value / 1_000_000;
}
