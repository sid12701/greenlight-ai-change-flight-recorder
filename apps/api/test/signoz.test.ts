import { describe, expect, it } from "vitest";
import {
  computeErrorRatePercent,
  parseLatencyMs,
  parseRequestCount,
  parseScalarSeries,
  parseTraceIds,
  renderQueryTemplate,
} from "../src/modules/signoz/client.js";

describe("signoz adapter", () => {
  it("renders version-controlled query templates", () => {
    const body = renderQueryTemplate("baseline-p95.json", {
      serviceName: "lms-backend",
      serviceVersion: "abc",
      environmentName: "hackathon-demo",
      route: "/api/v1/internal/home/overview",
      startMs: 1,
      endMs: 2,
    });
    expect(body).toContain("lms-backend");
    expect(body).toContain("/api/v1/internal/home/overview");
  });

  it("parses healthy scalar series", () => {
    const payload = {
      data: {
        result: [{ series: [{ values: [{ value: "250" }] }] }],
      },
    };
    expect(parseRequestCount(payload)).toBe(250);
    expect(parseScalarSeries({})).toBeNull();
  });

  it("converts latency nanoseconds to milliseconds", () => {
    const payload = {
      data: {
        result: [{ series: [{ values: [{ value: "150000000" }] }] }],
      },
    };
    expect(parseLatencyMs(payload)).toBe(150);
  });

  it("does not invent zero values for missing series", () => {
    expect(parseRequestCount(null)).toBeNull();
    expect(parseLatencyMs(undefined)).toBeNull();
  });

  it("computes error rate from request and error counts", () => {
    expect(computeErrorRatePercent(200, 10)).toBe(5);
    expect(computeErrorRatePercent(null, 10)).toBeNull();
    expect(computeErrorRatePercent(0, 10)).toBeNull();
  });

  it("parses trace ids from table payloads", () => {
    const payload = {
      data: {
        result: [
          {
            table: {
              records: [
                { data: { traceID: "abc123" } },
                { data: { traceID: "def456" } },
              ],
            },
          },
        ],
      },
    };
    expect(parseTraceIds(payload, 3)).toEqual(["abc123", "def456"]);
  });
});
