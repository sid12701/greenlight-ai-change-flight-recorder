import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, ResponseContractError, fetchChanges, fetchDependencyStatus } from "./client";

function respondWith(body: string, init: ResponseInit = {}) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, init)));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("API client", () => {
  // A proxy in front of the API answers 200 with an HTML error page. Letting
  // the JSON parse throw would surface a raw SyntaxError, which `describeFailure`
  // can only render as "something failed" — the one message this layer exists
  // to avoid.
  it("reports an unparseable body as a contract failure, not an unhandled throw", async () => {
    respondWith("<html>502 Bad Gateway</html>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
    await expect(fetchChanges()).rejects.toBeInstanceOf(ResponseContractError);
  });

  it("reports a well-formed body that breaks the contract as a contract failure", async () => {
    respondWith(JSON.stringify({ changes: [{ commitSha: 12345 }] }));
    await expect(fetchChanges()).rejects.toBeInstanceOf(ResponseContractError);
  });

  it("maps a transport failure to an unreachable API rather than a status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));
    await expect(fetchChanges()).rejects.toMatchObject({ status: 0, code: "unavailable" });
  });

  it("surfaces the status the API answered with", async () => {
    respondWith("{}", { status: 404 });
    await expect(fetchChanges()).rejects.toBeInstanceOf(ApiError);
  });

  // A degraded dependency is the answer the landing page exists to show, so a
  // complete 503 body is data rather than a request failure.
  it("reads a degraded dependency report out of a 503", async () => {
    respondWith(
      JSON.stringify({
        status: "degraded",
        checks: { database: "ok", github: "ok", signoz: "degraded" },
      }),
      { status: 503 },
    );
    await expect(fetchDependencyStatus()).resolves.toMatchObject({
      status: "degraded",
      checks: { signoz: "degraded" },
    });
  });
});
