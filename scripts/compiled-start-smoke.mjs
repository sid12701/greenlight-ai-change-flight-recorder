#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempDir = mkdtempSync(join(tmpdir(), "greenlight-compiled-"));
const databasePath = join(tempDir, "compiled.db");
const port = await availablePort();
let worker;
const child = spawn(process.execPath, ["apps/api/dist/server.js"], {
  cwd: new URL("..", import.meta.url),
  env: {
    ...process.env,
    GREENLIGHT_ENV: "test",
    GREENLIGHT_PORT: String(port),
    GREENLIGHT_HOST: "127.0.0.1",
    GREENLIGHT_DATABASE_PATH: databasePath,
    GREENLIGHT_ADMIN_TOKEN: "compiled-start-admin-token-0123456789",
    GITHUB_TOKEN: "compiled-start-github",
    GITHUB_REPOSITORY: "demo/workload",
    SIGNOZ_API_KEY: "compiled-start-signoz",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let stderr = "";
child.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
});

try {
  let response;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`compiled API exited early (${child.exitCode}): ${stderr}`);
    }
    try {
      response = await fetch(`http://127.0.0.1:${port}/livez`);
      if (response.ok) {
        break;
      }
    } catch {
      // The listener may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!response?.ok) {
    throw new Error(`compiled API did not become live: ${stderr}`);
  }
  child.kill("SIGTERM");
  const exitCode = await new Promise((resolve) => child.once("exit", resolve));
  if (exitCode !== 0) {
    throw new Error(`compiled API did not shut down cleanly (${exitCode}): ${stderr}`);
  }
  worker = spawn(process.execPath, ["apps/api/dist/worker.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      GREENLIGHT_ENV: "test",
      GREENLIGHT_DATABASE_PATH: databasePath,
      GREENLIGHT_ADMIN_TOKEN: "compiled-start-admin-token-0123456789",
      GITHUB_TOKEN: "compiled-start-github",
      GITHUB_REPOSITORY: "demo/workload",
      SIGNOZ_API_KEY: "compiled-start-signoz",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let workerError = "";
  worker.stderr.on("data", (chunk) => {
    workerError += chunk.toString();
  });
  await new Promise((resolve) => setTimeout(resolve, 400));
  if (worker.exitCode !== null) {
    throw new Error(`compiled worker exited early (${worker.exitCode}): ${workerError}`);
  }
  worker.kill("SIGTERM");
  const workerExitCode = await new Promise((resolve) => worker.once("exit", resolve));
  if (workerExitCode !== 0) {
    throw new Error(`compiled worker did not shut down cleanly (${workerExitCode}): ${workerError}`);
  }
  console.log("compiled-start-smoke: compiled API and worker migrated, started, and drained");
} finally {
  if (child.exitCode === null) {
    child.kill("SIGKILL");
  }
  if (worker?.exitCode === null) {
    worker.kill("SIGKILL");
  }
  rmSync(tempDir, { recursive: true, force: true });
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const selected = typeof address === "object" && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(selected));
    });
  });
}
