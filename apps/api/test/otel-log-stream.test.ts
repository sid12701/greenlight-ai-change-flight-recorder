import { describe, expect, it } from "vitest";
import { SeverityNumber } from "@opentelemetry/api-logs";
import { createOtelLogStream } from "../src/observability/otel-log-stream.js";

function collect() {
  const emitted: Array<Record<string, unknown>> = [];
  const written: string[] = [];
  const stream = createOtelLogStream({
    service: "greenlight-api",
    write: (line) => written.push(line),
    emit: (record) => emitted.push(record as unknown as Record<string, unknown>),
  });
  return { stream, emitted, written };
}

describe("fastify log forwarding", () => {
  it("forwards a request record with its identifiers as attributes", () => {
    const { stream, emitted, written } = collect();

    stream.write(JSON.stringify({
      level: 30,
      time: 1_700_000_000_000,
      pid: 1,
      hostname: "api",
      reqId: "req-1",
      req: { method: "GET", url: "/api/v1/changes" },
      msg: "request completed",
    }) + "\n");

    expect(written).toHaveLength(1);
    expect(emitted).toHaveLength(1);
    const record = emitted[0];
    expect(record.body).toBe("request completed");
    expect(record.severityNumber).toBe(SeverityNumber.INFO);

    const attributes = record.attributes as Record<string, unknown>;
    // Nested objects are flattened so a query can filter on the identifier
    // directly rather than matching inside a serialised blob.
    expect(attributes.reqId).toBe("req-1");
    expect(attributes["req.method"]).toBe("GET");
    expect(attributes["req.url"]).toBe("/api/v1/changes");
    // Envelope fields describe the record, not the event.
    expect(attributes.pid).toBeUndefined();
    expect(attributes.hostname).toBeUndefined();
  });

  it("maps pino levels to their OpenTelemetry severity", () => {
    const { stream, emitted } = collect();
    for (const level of [10, 30, 40, 50, 60]) {
      stream.write(JSON.stringify({ level, msg: "m" }) + "\n");
    }
    expect(emitted.map((record) => record.severityNumber)).toEqual([
      SeverityNumber.TRACE,
      SeverityNumber.INFO,
      SeverityNumber.WARN,
      SeverityNumber.ERROR,
      SeverityNumber.FATAL,
    ]);
  });

  it("still writes a non-JSON line to stdout instead of throwing", () => {
    const { stream, emitted, written } = collect();

    // Throwing here would fail inside the logger and take down the request
    // that produced the line.
    expect(() => stream.write("not json\n")).not.toThrow();
    expect(written).toEqual(["not json\n"]);
    expect(emitted).toHaveLength(0);
  });
});
