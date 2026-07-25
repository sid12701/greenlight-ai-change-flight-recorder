import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

export const DEFAULT_BASE_URL = "http://127.0.0.1:18081";

function requiredKey(env) {
  const key = env.BLNK_DEMO_KEY?.trim();
  if (!key) {
    throw new Error("BLNK_DEMO_KEY is required");
  }
  return key;
}

export function parseLoadArgs(argv, env = process.env) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith("--") || value === undefined) {
      throw new Error(`Invalid argument: ${flag ?? "<empty>"}`);
    }
    values.set(flag, value);
  }
  const integer = (flag, fallback, minimum = 1) => {
    const parsed = Number(values.get(flag) ?? fallback);
    if (!Number.isInteger(parsed) || parsed < minimum) {
      throw new Error(`${flag} must be an integer >= ${minimum}`);
    }
    return parsed;
  };
  const profile = values.get("--profile") ?? "healthy";
  if (!["healthy", "not-found", "outage"].includes(profile)) {
    throw new Error("--profile must be healthy, not-found, or outage");
  }
  return {
    baseUrl: values.get("--base-url") ?? env.BLNK_BASE_URL ?? DEFAULT_BASE_URL,
    key: requiredKey(env),
    profile,
    durationSeconds: integer("--duration-seconds", env.GREENLIGHT_LOAD_SECONDS ?? "90"),
    concurrency: integer("--concurrency", env.GREENLIGHT_LOAD_CONCURRENCY ?? "5"),
    requests: integer("--requests", env.GREENLIGHT_LOAD_TARGET ?? "250"),
  };
}

async function jsonRequest(baseUrl, key, path, init = {}, fetchImpl = fetch) {
  const response = await fetchImpl(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Blnk-Key": key,
      ...init.headers,
    },
  });
  const body = await response.text();
  const payload = body ? JSON.parse(body) : undefined;
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} failed: ${response.status}`);
  }
  return payload;
}

export async function seedWorkload(
  { baseUrl, key, stateFile },
  fetchImpl = fetch,
) {
  let existing;
  try {
    existing = JSON.parse(await readFile(stateFile, "utf8"));
    await jsonRequest(baseUrl, key, `/ledgers/${existing.ledgerId}`, {}, fetchImpl);
    await Promise.all(
      existing.balanceIds.map((id) =>
        jsonRequest(baseUrl, key, `/balances/${id}`, {}, fetchImpl),
      ),
    );
    return { ...existing, reused: true };
  } catch {
    // Missing or stale local seed state is recreated below.
  }

  const ledger = await jsonRequest(
    baseUrl,
    key,
    "/ledgers",
    {
      method: "POST",
      body: JSON.stringify({
        name: `GreenLight loan book ${randomUUID()}`,
        meta_data: { purpose: "hackathon-demo", data_classification: "synthetic" },
      }),
    },
    fetchImpl,
  );
  const balances = await Promise.all(
    ["loan-disbursement", "borrower-repayment"].map((purpose) =>
      jsonRequest(
        baseUrl,
        key,
        "/balances",
        {
          method: "POST",
          body: JSON.stringify({
            ledger_id: ledger.ledger_id,
            currency: "USD",
            meta_data: { purpose, data_classification: "synthetic" },
          }),
        },
        fetchImpl,
      ),
    ),
  );
  const state = {
    ledgerId: ledger.ledger_id,
    balanceIds: balances.map((balance) => balance.balance_id),
  };
  await writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`, {
    mode: 0o600,
  });
  return { ...state, reused: false };
}

export async function runLoad(options, fetchImpl = fetch) {
  const deadline = Date.now() + options.durationSeconds * 1_000;
  const counts = {
    requested: options.requests,
    attempted: 0,
    succeeded: 0,
    applicationErrors: 0,
    transportErrors: 0,
  };
  const path =
    options.profile === "not-found"
      ? "/balances/bal_intentional_greenlight_404"
      : "/balances?limit=10&offset=0";

  async function worker() {
    while (Date.now() < deadline && counts.attempted < options.requests) {
      counts.attempted += 1;
      try {
        const response = await fetchImpl(`${options.baseUrl}${path}`, {
          headers: { "X-Blnk-Key": options.key },
        });
        if (response.ok) {
          counts.succeeded += 1;
        } else {
          counts.applicationErrors += 1;
        }
      } catch {
        counts.transportErrors += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: options.concurrency }, () => worker()));
  return { path, ...counts };
}
