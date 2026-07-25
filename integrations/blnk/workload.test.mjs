import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parseLoadArgs, runLoad, seedWorkload } from "./workload.mjs";

test("load arguments require a key and reject unsupported profiles", () => {
  const options = parseLoadArgs(
    ["--requests", "12", "--concurrency", "2", "--profile", "not-found"],
    { BLNK_DEMO_KEY: "secret" },
  );
  assert.equal(options.requests, 12);
  assert.equal(options.profile, "not-found");
  assert.throws(() => parseLoadArgs([], {}), /BLNK_DEMO_KEY is required/);
  assert.throws(
    () => parseLoadArgs(["--profile", "slow"], { BLNK_DEMO_KEY: "secret" }),
    /healthy, not-found, or outage/,
  );
});

test("bounded error load counts application failures without aborting", async () => {
  const options = parseLoadArgs(
    [
      "--requests",
      "6",
      "--duration-seconds",
      "5",
      "--concurrency",
      "2",
      "--profile",
      "not-found",
    ],
    { BLNK_DEMO_KEY: "secret" },
  );
  const result = await runLoad(
    options,
    async () => new Response("", { status: 404 }),
    async () => {},
  );
  assert.deepEqual(result, {
    path: "/balances/bal_intentional_greenlight_404",
    requested: 6,
    attempted: 6,
    succeeded: 0,
    applicationErrors: 6,
    transportErrors: 0,
  });
});

test("load is spread across the requested duration rather than burst", async () => {
  const options = parseLoadArgs(
    ["--requests", "4", "--duration-seconds", "8", "--concurrency", "2"],
    { BLNK_DEMO_KEY: "secret" },
  );
  const waits = [];
  const result = await runLoad(
    options,
    async () => new Response("{}", { status: 200 }),
    async (milliseconds) => {
      waits.push(Math.round(milliseconds));
    },
  );

  assert.equal(result.attempted, 4);
  assert.equal(result.succeeded, 4);
  // 4 requests across 8s is one every 2s; the first is issued immediately, so
  // the remaining three each wait an additional interval.
  assert.deepEqual(waits, [2000, 4000, 6000]);
});

test("seed creates synthetic ledger and balances then reuses verified state", async () => {
  const directory = await mkdtemp(join(tmpdir(), "greenlight-blnk-"));
  const stateFile = join(directory, "seed.json");
  const calls = [];
  const ids = {
    ledger_id: "ldg_demo",
    balances: ["bal_source", "bal_repayment"],
  };
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (init.method === "POST" && String(url).endsWith("/ledgers")) {
      return Response.json({ ledger_id: ids.ledger_id }, { status: 201 });
    }
    if (init.method === "POST" && String(url).endsWith("/balances")) {
      const index = calls.filter(
        (call) =>
          call.init.method === "POST" && call.url.endsWith("/balances"),
      ).length;
      return Response.json(
        { balance_id: ids.balances[index - 1] },
        { status: 201 },
      );
    }
    return Response.json({ ok: true });
  };

  const created = await seedWorkload(
    { baseUrl: "http://blnk", key: "secret", stateFile },
    fetchImpl,
  );
  assert.deepEqual(created, {
    ledgerId: ids.ledger_id,
    balanceIds: ids.balances,
    reused: false,
  });
  const onDisk = JSON.parse(await readFile(stateFile, "utf8"));
  assert.deepEqual(onDisk.balanceIds, ids.balances);

  calls.length = 0;
  const reused = await seedWorkload(
    { baseUrl: "http://blnk", key: "secret", stateFile },
    fetchImpl,
  );
  assert.equal(reused.reused, true);
  assert.equal(calls.length, 3);
  assert.ok(
    calls.every((call) => call.init.headers["X-Blnk-Key"] === "secret"),
  );
});
