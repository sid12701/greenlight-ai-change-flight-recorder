#!/usr/bin/env node
const [jobId] = process.argv.slice(2);
const apiUrl = process.env.GREENLIGHT_API_URL ?? "http://127.0.0.1:4000";
const token = process.env.GREENLIGHT_ADMIN_TOKEN;
if (!jobId || !token) {
  throw new Error("usage: GREENLIGHT_ADMIN_TOKEN=<token> wait-job.mjs <job-id>");
}

const deadline = Date.now() + Number(process.env.GREENLIGHT_JOB_TIMEOUT_MS ?? 300_000);
while (Date.now() < deadline) {
  const response = await fetch(`${apiUrl}/api/v1/jobs/${encodeURIComponent(jobId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`job status request failed: HTTP ${response.status}`);
  }
  const job = await response.json();
  if (job.state === "succeeded") {
    console.log(JSON.stringify(job.result));
    process.exit(0);
  }
  if (job.state === "failed") {
    throw new Error(`job failed after ${job.attempts} attempts: ${job.lastError}`);
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
throw new Error(`job ${jobId} did not complete before the timeout`);
