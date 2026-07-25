import { describe, expect, it, vi } from "vitest";
import {
  SignozClient,
  SignozIntegrationError,
  computeErrorRatePercent,
} from "../src/modules/signoz/client.js";
import {
  buildSlowTraceRequest,
  buildTraceVerificationRequest,
  buildWindowMetricsRequest,
  quoteFilterValue,
  readScalarAggregation,
  SignozQueryError,
} from "../src/modules/signoz/query.js";

const WINDOW = {
  serviceName: "lms-backend",
  serviceVersion: "c6618e1621ebc1765564446bac68f71293eb79be",
  environmentName: "hackathon-demo",
  route: "/api/v1/internal/home/overview",
  startMs: 1_700_000_000_000,
  endMs: 1_700_000_090_000,
};

/** Response envelope produced by SigNoz v5 for a scalar request. */
function scalarResponse(results: Array<{ queryName: string; values: number[] }>) {
  return {
    status: "success",
    data: {
      type: "scalar",
      data: {
        results: results.map((result) => ({
          queryName: result.queryName,
          columns: result.values.map((_value, index) => ({ name: `__result_${index}` })),
          data: result.values.length ? [result.values] : [],
        })),
      },
    },
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function clientWith(fetchImpl: typeof fetch, overrides: Record<string, unknown> = {}) {
  return new SignozClient("http://signoz.test", "test-key", {
    fetchImpl,
    sleepImpl: async () => {},
    randomImpl: () => 0,
    maxAttempts: 3,
    ...overrides,
  });
}

describe("signoz v5 request contract", () => {
  it("builds a single scalar request carrying count, p90, p95 and error count", () => {
    const request = buildWindowMetricsRequest(WINDOW);

    expect(request.schemaVersion).toBe("v1");
    expect(request.requestType).toBe("scalar");
    expect(request.start).toBe(WINDOW.startMs);
    expect(request.end).toBe(WINDOW.endMs);

    const [totals, errors] = request.compositeQuery.queries;
    expect(totals.type).toBe("builder_query");
    expect(totals.spec.signal).toBe("traces");
    expect(totals.spec.aggregations?.map((entry) => entry.expression)).toEqual([
      "count()",
      "p90(duration_nano)",
      "p95(duration_nano)",
    ]);
    expect(totals.spec.filter?.expression).toBe(
      "service.name = 'lms-backend' AND " +
      "service.version = 'c6618e1621ebc1765564446bac68f71293eb79be' AND " +
      "deployment.environment.name = 'hackathon-demo' AND " +
      "http.route = '/api/v1/internal/home/overview'",
    );
    expect(errors.spec.filter?.expression).toContain("has_error = true");
  });

  it("orders slow traces by duration and bounds the result set", () => {
    const request = buildSlowTraceRequest(WINDOW, 3);
    expect(request.requestType).toBe("raw");
    expect(request.compositeQuery.queries[0].spec.order).toEqual([
      { key: { name: "duration_nano" }, direction: "desc" },
    ]);
    expect(request.compositeQuery.queries[0].spec.limit).toBe(3);
  });

  it("adds a span-scoped query only when a span id must be proved", () => {
    const withoutSpan = buildTraceVerificationRequest({
      traceId: "de15a110661a6b1ccec37e8ed468e3cd",
      startMs: 1,
      endMs: 2,
    });
    expect(withoutSpan.compositeQuery.queries).toHaveLength(1);

    const withSpan = buildTraceVerificationRequest({
      traceId: "de15a110661a6b1ccec37e8ed468e3cd",
      spanId: "e292d34b0baa7f1a",
      startMs: 1,
      endMs: 2,
    });
    expect(withSpan.compositeQuery.queries).toHaveLength(2);
    expect(withSpan.compositeQuery.queries[1].spec.filter?.expression)
      .toContain("span_id = 'e292d34b0baa7f1a'");
  });

  it("rejects values that could alter the structure of a filter expression", () => {
    expect(quoteFilterValue("o'brien")).toBe("'o\\'brien'");
    expect(() => buildWindowMetricsRequest({ ...WINDOW, serviceName: "a' OR '1'='1" }))
      .toThrow();
    expect(() => buildTraceVerificationRequest({ traceId: "not-a-trace", startMs: 1, endMs: 2 }))
      .toThrow();
  });

  it("rejects an inverted window", () => {
    expect(() => buildWindowMetricsRequest({ ...WINDOW, endMs: WINDOW.startMs - 1 })).toThrow();
  });
});

describe("signoz v5 response parsing", () => {
  it("reads each aggregation slot of a multi-aggregation query", () => {
    const payload = scalarResponse([
      { queryName: "A", values: [209, 738_651_116.6, 1_040_952_692.2] },
    ]);
    expect(readScalarAggregation(payload, "A", 0)).toBe(209);
    expect(readScalarAggregation(payload, "A", 1)).toBeCloseTo(738_651_116.6);
    expect(readScalarAggregation(payload, "A", 2)).toBeCloseTo(1_040_952_692.2);
  });

  it("reports absent data as null rather than zero", () => {
    const payload = scalarResponse([{ queryName: "A", values: [] }]);
    expect(readScalarAggregation(payload, "A", 0)).toBeNull();
  });

  it("never turns a null percentile into a zero measurement", () => {
    // SigNoz answers an empty window with [count, null, null]. Coercing those
    // nulls to 0 would report 0ms latency, which reads as a dramatic
    // improvement rather than an absence of data.
    const payload = {
      status: "success",
      data: {
        type: "scalar",
        data: {
          results: [{
            queryName: "A",
            columns: [
              { name: "__result_0" }, { name: "__result_1" }, { name: "__result_2" },
            ],
            data: [[0, null, null]],
          }],
        },
      },
    };
    expect(readScalarAggregation(payload, "A", 0)).toBe(0);
    expect(readScalarAggregation(payload, "A", 1)).toBeNull();
    expect(readScalarAggregation(payload, "A", 2)).toBeNull();
  });

  it("throws rather than guessing when the envelope is unrecognised", () => {
    expect(() => readScalarAggregation({ unexpected: true }, "A")).toThrow(SignozQueryError);
  });

  it("converts latency nanoseconds to milliseconds and keeps p90 distinct from p95", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(scalarResponse([
      { queryName: "A", values: [209, 738_651_116.6, 1_040_952_692.2] },
      { queryName: "B", values: [4] },
    ])));

    const metrics = await clientWith(fetchImpl as unknown as typeof fetch).queryWindow(WINDOW);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(metrics.requestCount).toBe(209);
    expect(metrics.errorCount).toBe(4);
    expect(metrics.p90Ms).toBeCloseTo(738.65, 1);
    expect(metrics.p95Ms).toBeCloseTo(1_040.95, 1);
    expect(metrics.p90Ms).not.toBe(metrics.p95Ms);
    expect(metrics.errorRatePercent).toBeCloseTo((4 / 209) * 100, 6);
  });

  it("treats a missing error row as zero errors only when traffic was observed", async () => {
    const withTraffic = await clientWith((async () => jsonResponse(scalarResponse([
      { queryName: "A", values: [100, 1_000_000, 2_000_000] },
      { queryName: "B", values: [] },
    ]))) as unknown as typeof fetch).queryWindow(WINDOW);
    expect(withTraffic.errorCount).toBe(0);
    expect(withTraffic.errorRatePercent).toBe(0);

    const withoutTraffic = await clientWith((async () => jsonResponse(scalarResponse([
      { queryName: "A", values: [] },
      { queryName: "B", values: [] },
    ]))) as unknown as typeof fetch).queryWindow(WINDOW);
    expect(withoutTraffic.requestCount).toBeNull();
    expect(withoutTraffic.errorCount).toBeNull();
    expect(withoutTraffic.errorRatePercent).toBeNull();
  });
});

describe("empty windows", () => {
  it("reports an unmatched window as absent across every field", async () => {
    const client = clientWith((async () => jsonResponse({
      status: "success",
      data: {
        type: "scalar",
        data: {
          results: [
            {
              queryName: "A",
              columns: [
                { name: "__result_0" }, { name: "__result_1" }, { name: "__result_2" },
              ],
              data: [[0, null, null]],
            },
            { queryName: "B", columns: [{ name: "__result_0" }], data: [[0]] },
          ],
        },
      },
    })) as unknown as typeof fetch);

    const metrics = await client.queryWindow(WINDOW);
    expect(metrics.requestCount).toBeNull();
    expect(metrics.p90Ms).toBeNull();
    expect(metrics.p95Ms).toBeNull();
    expect(metrics.errorRatePercent).toBeNull();
  });
});

describe("signoz failure handling", () => {
  it("surfaces an unauthorized key as a non-retryable integration error", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ status: "error" }, 401));
    const client = clientWith(fetchImpl as unknown as typeof fetch);

    await expect(client.queryWindow(WINDOW)).rejects.toMatchObject({
      name: "SignozIntegrationError",
      code: "signoz_unauthorized",
      retryable: false,
    });
    // A rejected credential never becomes valid by retrying.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("surfaces a rejected query shape as a non-retryable integration error", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(
      { status: "error", error: { message: "atleast one query is required" } },
      400,
    ));
    await expect(clientWith(fetchImpl as unknown as typeof fetch).queryWindow(WINDOW))
      .rejects.toMatchObject({ code: "signoz_invalid_request", retryable: false });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries transient failures up to the configured budget and then gives up", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ status: "error" }, 503));
    const client = clientWith(fetchImpl as unknown as typeof fetch, { maxAttempts: 3 });

    await expect(client.queryWindow(WINDOW)).rejects.toBeInstanceOf(SignozIntegrationError);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("never reports a version as visible when SigNoz cannot answer", async () => {
    const client = clientWith((async () => jsonResponse({}, 500)) as unknown as typeof fetch);
    await expect(client.isVersionVisible(WINDOW)).rejects.toBeInstanceOf(SignozIntegrationError);
  });

  it("reports the credential as unhealthy when the query path is rejected", async () => {
    const rejecting = clientWith((async () => jsonResponse({}, 401)) as unknown as typeof fetch);
    await expect(rejecting.checkHealth()).resolves.toBe(false);

    const accepting = clientWith((async () => jsonResponse(
      scalarResponse([{ queryName: "A", values: [1] }]),
    )) as unknown as typeof fetch);
    await expect(accepting.checkHealth()).resolves.toBe(true);
  });
});

describe("signoz trace verification", () => {
  const traceId = "de15a110661a6b1ccec37e8ed468e3cd";

  it("verifies a trace only when every stated expectation holds", async () => {
    const client = clientWith((async () => jsonResponse({
      status: "success",
      data: {
        type: "scalar",
        data: {
          results: [
            {
              queryName: "A",
              columns: [{ name: "service.name" }, { name: "__result_0" }],
              data: [["claude-code", 12]],
            },
            { queryName: "B", columns: [{ name: "__result_0" }], data: [[1]] },
          ],
        },
      },
    })) as unknown as typeof fetch);

    await expect(client.verifyTrace({
      traceId,
      spanId: "e292d34b0baa7f1a",
      expectedServiceName: "claude-code",
      expectedSpanCount: 12,
      startMs: 1,
      endMs: 2,
    })).resolves.toBe(true);

    await expect(client.verifyTrace({
      traceId,
      expectedServiceName: "some-other-service",
      startMs: 1,
      endMs: 2,
    })).resolves.toBe(false);

    await expect(client.verifyTrace({ traceId, expectedSpanCount: 13, startMs: 1, endMs: 2 }))
      .resolves.toBe(false);
  });

  it("reports an absent trace as unverified", async () => {
    const client = clientWith((async () => jsonResponse(
      scalarResponse([{ queryName: "A", values: [] }]),
    )) as unknown as typeof fetch);
    await expect(client.verifyTrace({ traceId, startMs: 1, endMs: 2 })).resolves.toBe(false);
  });

  it("refuses to build a trace URL from a malformed identifier", () => {
    const client = clientWith((async () => jsonResponse({})) as unknown as typeof fetch);
    expect(client.buildTraceUrl(traceId)).toBe(`http://signoz.test/trace/${traceId}`);
    expect(() => client.buildTraceUrl("../../etc/passwd")).toThrow(SignozIntegrationError);
  });

  it("publishes links on the reader's origin, not the origin it queries", () => {
    // A containerised API queries SigNoz over the Docker host gateway. A link
    // built from that origin resolves nowhere in a reader's browser, so both
    // link builders must use the public origin while queries keep using the
    // internal one.
    const client = clientWith((async () => jsonResponse({})) as unknown as typeof fetch, {
      publicBaseUrl: "http://127.0.0.1:8080",
      deploymentDashboardId: "dash-1",
    });

    expect(client.buildTraceUrl(traceId)).toBe(`http://127.0.0.1:8080/trace/${traceId}`);
    expect(client.buildDashboardUrl({
      serviceName: "blnk-loan-workload",
      serviceVersion: "abc",
      environmentName: "hackathon-demo",
      route: "/balances",
      startMs: 1,
      endMs: 2,
    })).toContain("http://127.0.0.1:8080/dashboard/dash-1");
  });

  it("falls back to the query origin when no public origin is configured", () => {
    const client = clientWith((async () => jsonResponse({})) as unknown as typeof fetch);
    expect(client.buildTraceUrl(traceId)).toBe(`http://signoz.test/trace/${traceId}`);
  });
});

describe("error rate", () => {
  it("is null when the window carried no traffic", () => {
    expect(computeErrorRatePercent(0, 0)).toBeNull();
    expect(computeErrorRatePercent(null, 3)).toBeNull();
    expect(computeErrorRatePercent(200, null)).toBeNull();
    expect(computeErrorRatePercent(200, 10)).toBe(5);
  });
});
