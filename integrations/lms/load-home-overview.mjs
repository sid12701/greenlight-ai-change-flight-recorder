#!/usr/bin/env node
import { pathToFileURL } from "node:url";

export function parseArgs(argv, env = process.env) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!flag.startsWith("--") || index + 1 >= argv.length) {
      throw new Error(`Invalid argument: ${flag}`);
    }
    values.set(flag, argv[index + 1]);
    index += 1;
  }
  const integer = (flag, fallback, minimum = 1) => {
    const raw = values.get(flag) ?? fallback;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < minimum) {
      throw new Error(`${flag} must be an integer >= ${minimum}`);
    }
    return parsed;
  };
  const email = env.LMS_LOGIN_EMAIL ?? env.LMS_DEMO_USERNAME;
  const password = env.LMS_LOGIN_PASSWORD ?? env.LMS_DEMO_PASSWORD;
  if (!email || !password) {
    throw new Error("LMS_LOGIN_EMAIL and LMS_LOGIN_PASSWORD are required");
  }
  return {
    baseUrl: values.get("--base-url") ?? env.LMS_BASE_URL ?? "http://127.0.0.1:8081",
    route: values.get("--route") ?? env.LMS_DEMO_ROUTE ?? "/api/v1/internal/home/overview",
    durationSeconds: integer("--duration-seconds", env.GREENLIGHT_LOAD_SECONDS ?? "90"),
    concurrency: integer("--concurrency", env.GREENLIGHT_LOAD_CONCURRENCY ?? "5"),
    requests: integer("--requests", env.GREENLIGHT_LOAD_TARGET ?? "250"),
    email,
    password,
  };
}

async function login(options, fetchImpl) {
  const response = await fetchImpl(`${options.baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: options.email, password: options.password }),
  });
  if (!response.ok) {
    throw new Error(`login failed: ${response.status}`);
  }
  const payload = await response.json();
  const token = payload.accessToken ?? payload.token;
  if (!token) {
    throw new Error("login response did not include an access token");
  }
  return token;
}

export async function runLoad(options, fetchImpl = fetch) {
  const token = await login(options, fetchImpl);
  const deadline = Date.now() + options.durationSeconds * 1_000;
  const counts = {
    requested: options.requests,
    attempted: 0,
    succeeded: 0,
    applicationErrors: 0,
    transportErrors: 0,
  };

  async function worker() {
    while (Date.now() < deadline) {
      if (counts.attempted >= options.requests) {
        return;
      }
      counts.attempted += 1;
      try {
        const response = await fetchImpl(`${options.baseUrl}${options.route}`, {
          headers: { Authorization: `Bearer ${token}` },
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
  return counts;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const counts = await runLoad(options);
  console.log(JSON.stringify({ route: options.route, ...counts }));
  if (counts.attempted < counts.requested) {
    console.error(
      `load-home-overview: deadline reached after ${counts.attempted}/${counts.requested} attempts`,
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`load-home-overview: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  });
}
