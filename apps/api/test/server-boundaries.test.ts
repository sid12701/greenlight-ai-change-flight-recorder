import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Repositories } from "../src/db/repositories/index.js";
import { buildServer } from "../src/app.js";
import { testConfig } from "./support/config.js";

describe("HTTP boundaries", () => {
  const cleanups: Array<() => Promise<void> | void> = [];
  afterEach(async () => {
    while (cleanups.length) {
      await cleanups.pop()?.();
    }
  });

  async function setup() {
    const directory = mkdtempSync(join(tmpdir(), "greenlight-http-"));
    const databasePath = join(directory, "test.db");
    const config = testConfig({
      GREENLIGHT_DATABASE_PATH: databasePath,
      GREENLIGHT_ADMIN_TOKEN: "admin-token-with-safe-length",
      GREENLIGHT_API_KEYS: JSON.stringify([
        { id: "reader", key: "reader-token-with-safe-length", scopes: ["read"] },
      ]),
      GREENLIGHT_REQUIRE_READ_AUTH: "true",
      GREENLIGHT_ALLOWED_ORIGINS: "http://allowed.test",
    });
    const app = await buildServer(config);
    cleanups.push(async () => {
      await app.close();
      rmSync(directory, { recursive: true, force: true });
    });
    return { app, databasePath };
  }

  it("enforces origin allowlists and scoped read authorization", async () => {
    const { app } = await setup();
    const forbidden = await app.inject({
      method: "GET",
      url: "/api/v1/changes",
      headers: {
        origin: "http://evil.test",
        authorization: "Bearer reader-token-with-safe-length",
      },
    });
    expect(forbidden.statusCode).toBe(403);

    const allowed = await app.inject({
      method: "GET",
      url: "/api/v1/changes",
      headers: {
        origin: "http://allowed.test",
        authorization: "Bearer reader-token-with-safe-length",
      },
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://allowed.test");
  });

  it("rejects malformed mutations before durable work is created", async () => {
    const { app, databasePath } = await setup();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/deployments",
      headers: { authorization: "Bearer admin-token-with-safe-length" },
      payload: {
        repository: "demo/workload",
        commitSha: "short",
      },
    });
    expect(response.statusCode).toBe(400);
    const repos = Repositories.create(databasePath);
    expect(await repos.claimNextJob(new Date().toISOString())).toBeUndefined();
    await repos.close();
  });

  it("accepts valid mutations as durable worker jobs and denies read-only keys", async () => {
    const { app } = await setup();
    const payload = {
      repository: "demo/workload",
      runIds: [123],
    };
    const denied = await app.inject({
      method: "POST",
      url: "/api/v1/github/sync-runs",
      headers: { authorization: "Bearer reader-token-with-safe-length" },
      payload,
    });
    expect(denied.statusCode).toBe(403);

    const accepted = await app.inject({
      method: "POST",
      url: "/api/v1/github/sync-runs",
      headers: { authorization: "Bearer admin-token-with-safe-length" },
      payload,
    });
    expect(accepted.statusCode).toBe(202);
    expect(accepted.json()).toMatchObject({ state: "pending" });
  });

  it("permits credentialed reads from allowlisted origins only", async () => {
    const { app } = await setup();

    const allowed = await app.inject({
      method: "GET",
      url: "/api/v1/changes",
      headers: { origin: "http://allowed.test", authorization: "Bearer reader-token-with-safe-length" },
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://allowed.test");
    // The web client reads with the browser session instead of a token baked
    // into its bundle, so the browser requires this header to be present.
    expect(allowed.headers["access-control-allow-credentials"]).toBe("true");
    expect(allowed.headers["vary"]).toBe("Origin");

    const rejected = await app.inject({
      method: "GET",
      url: "/api/v1/changes",
      headers: { origin: "http://evil.example" },
    });
    expect(rejected.statusCode).toBe(403);
    expect(rejected.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("returns a typed 404 instead of a successful null receipt for an unknown commit", async () => {
    const { app } = await setup();
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/changes/${"f".repeat(40)}`,
      headers: { authorization: "Bearer reader-token-with-safe-length" },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      error: "not_found",
    });
    expect(response.json().requestId).toEqual(expect.any(String));
  });
});
