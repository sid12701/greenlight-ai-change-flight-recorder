import assert from "node:assert/strict";
import test from "node:test";
import { parseArgs, runLoad } from "./load-home-overview.mjs";

test("parses --requests and requires credentials", () => {
  const options = parseArgs(
    ["--requests", "12", "--concurrency", "2"],
    { LMS_LOGIN_EMAIL: "demo@example.test", LMS_LOGIN_PASSWORD: "secret" },
  );
  assert.equal(options.requests, 12);
  assert.equal(options.concurrency, 2);
  assert.throws(() => parseArgs([], {}), /required/);
});

test("counts application errors and continues to the requested attempt count", async () => {
  let overviewCalls = 0;
  const options = parseArgs(
    ["--requests", "6", "--duration-seconds", "5", "--concurrency", "2"],
    { LMS_LOGIN_EMAIL: "demo@example.test", LMS_LOGIN_PASSWORD: "secret" },
  );
  const result = await runLoad(options, async (url) => {
    if (String(url).endsWith("/api/v1/auth/login")) {
      return new Response(JSON.stringify({ accessToken: "token" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    overviewCalls += 1;
    return new Response("", { status: overviewCalls % 2 === 0 ? 200 : 500 });
  });
  assert.deepEqual(result, {
    requested: 6,
    attempted: 6,
    succeeded: 3,
    applicationErrors: 3,
    transportErrors: 0,
  });
});
