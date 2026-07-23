#!/usr/bin/env node
const args = process.argv.slice(2);
const requestsFlag = args.indexOf("--requests");
const targetFromArg = requestsFlag >= 0 ? Number(args[requestsFlag + 1]) : undefined;

const baseUrl = process.env.LMS_BASE_URL ?? "http://127.0.0.1:8081";
const route = "/api/v1/internal/home/overview";
const durationSeconds = Number(process.env.GREENLIGHT_LOAD_SECONDS ?? 90);
const concurrency = Number(process.env.GREENLIGHT_LOAD_CONCURRENCY ?? 5);
const targetCount = targetFromArg ?? Number(process.env.GREENLIGHT_LOAD_TARGET ?? 250);

const email = process.env.LMS_LOGIN_EMAIL ?? "ops.admin@bhawana.local";
const password = process.env.LMS_LOGIN_PASSWORD ?? "ChangeMe123!";

async function login() {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(`login failed: ${response.status}`);
  }
  const payload = await response.json();
  return payload.token ?? payload.accessToken;
}

async function hitOverview(token) {
  const response = await fetch(`${baseUrl}${route}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`request failed: ${response.status}`);
  }
}

const token = await login();
const deadline = Date.now() + durationSeconds * 1000;
let completed = 0;

while (Date.now() < deadline && completed < targetCount) {
  const workers = Array.from({ length: concurrency }, async () => {
    while (Date.now() < deadline && completed < targetCount) {
      await hitOverview(token);
      completed += 1;
    }
  });
  await Promise.all(workers);
}

const minimum = Math.min(200, targetCount);
if (completed < minimum) {
  console.error(`load-home-overview: only ${completed} requests completed (need ${minimum})`);
  process.exit(1);
}

console.log(`load-home-overview: completed ${completed} requests to ${route}`);
