import { afterEach, describe, expect, it, vi } from "vitest";
import { Repositories } from "../src/db/repositories/index.js";
import { AppError, DependencyError, RetryAfterError, ValidationError } from "../src/http/errors.js";
import { createLogger, type LogLevel } from "../src/observability/logger.js";
import { runWorker, scheduleRetry } from "../src/worker-runtime.js";
import { temporaryDatabase, testConfig } from "./support/config.js";

interface CapturedLog {
  level: LogLevel;
  message: string;
  fields: Record<string, unknown>;
}

function collectingLogger() {
  const records: CapturedLog[] = [];
  const logger = createLogger({
    level: "debug",
    service: "greenlight-worker-test",
    write: () => {},
    emit: (record) => records.push(record as CapturedLog),
  });
  return { logger, records };
}

describe("worker retry scheduling", () => {
  const now = Date.parse("2026-07-24T10:00:00.000Z");

  it("does not retry an error the caller marked non-retryable", () => {
    const outcome = scheduleRetry(new ValidationError("bad payload"), 1, 5, now);
    expect(outcome.terminal).toBe(true);
  });

  it("retries a dependency failure until the attempt budget is exhausted", () => {
    const error = new DependencyError("signoz_unavailable", "SigNoz is down");
    expect(scheduleRetry(error, 1, 5, now).terminal).toBe(false);
    expect(scheduleRetry(error, 5, 5, now).terminal).toBe(true);
  });

  it("uses the deadline carried by the error rather than parsing its message", () => {
    const notBefore = "2026-07-24T10:05:00.000Z";
    const outcome = scheduleRetry(
      new RetryAfterError("evaluation_window_incomplete", "window open", notBefore),
      1,
      5,
      now,
    );
    expect(outcome.terminal).toBe(false);
    expect(outcome.availableAt).toBe(notBefore);
  });

  it("falls back to exponential backoff when no deadline is known", () => {
    const outcome = scheduleRetry(new Error("transport reset"), 3, 5, now);
    expect(outcome.terminal).toBe(false);
    expect(Date.parse(outcome.availableAt) - now).toBe(4_000);
  });

  it("treats an unknown error as retryable so a transient fault is not discarded", () => {
    expect(scheduleRetry(new Error("boom"), 1, 5, now).terminal).toBe(false);
  });
});

describe("worker loop", () => {
  let cleanup = () => {};
  afterEach(() => cleanup());

  function setup() {
    const database = temporaryDatabase();
    cleanup = database.cleanup;
    const repos = Repositories.create(database.path);
    return { repos, config: testConfig({ GREENLIGHT_DATABASE_PATH: database.path }) };
  }

  it("completes a job and records its result", async () => {
    const { repos, config } = setup();
    const { logger, records } = collectingLogger();
    await repos.enqueueJob({ id: "job_ok", kind: "github_sync_latest", payload_json: "{}" });

    await runWorker({
      repos,
      config,
      logger,
      processJob: async () => ({ synced: 2 }),
      maxIterations: 1,
      sleep: async () => {},
    });

    const job = await repos.getJob("job_ok");
    expect(job?.state).toBe("succeeded");
    expect(JSON.parse(job?.result_json ?? "null")).toEqual({ synced: 2 });
    expect(records.some((entry) => entry.message === "job succeeded")).toBe(true);
    await repos.close();
  });

  it("reschedules a retryable failure and logs the reason", async () => {
    const { repos, config } = setup();
    const { logger, records } = collectingLogger();
    await repos.enqueueJob({ id: "job_retry", kind: "regression_evaluate", payload_json: "{}" });

    await runWorker({
      repos,
      config,
      logger,
      processJob: async () => {
        throw new DependencyError("signoz_unavailable", "SigNoz is unreachable");
      },
      maxIterations: 1,
      sleep: async () => {},
    });

    const job = await repos.getJob("job_retry");
    expect(job?.state).toBe("pending");
    expect(job?.last_error).toContain("SigNoz is unreachable");
    const failure = records.find((entry) => entry.message.startsWith("job failed"));
    expect(failure?.fields.error_code).toBe("signoz_unavailable");
    expect(failure?.fields.job_id).toBe("job_retry");
    await repos.close();
  });

  it("fails a non-retryable job immediately instead of burning the attempt budget", async () => {
    const { repos, config } = setup();
    const { logger } = collectingLogger();
    await repos.enqueueJob({ id: "job_invalid", kind: "deployment_record", payload_json: "{}" });

    await runWorker({
      repos,
      config,
      logger,
      processJob: async () => {
        throw new ValidationError("commitSha: Required");
      },
      maxIterations: 1,
      sleep: async () => {},
    });

    const job = await repos.getJob("job_invalid");
    expect(job?.state).toBe("failed");
    expect(job?.attempts).toBe(1);
    await repos.close();
  });

  it("stops a job that exceeds its deadline so one stuck dependency cannot block the queue", async () => {
    const { repos, config: base } = setup();
    const config = { ...base, GREENLIGHT_JOB_DEADLINE_MS: 20 };
    const { logger } = collectingLogger();
    await repos.enqueueJob({ id: "job_stuck", kind: "github_sync_runs", payload_json: "{}" });

    await runWorker({
      repos,
      config,
      logger,
      processJob: () => new Promise(() => {}),
      maxIterations: 1,
      sleep: async () => {},
    });

    expect((await repos.getJob("job_stuck"))?.last_error).toContain("deadline");
    await repos.close();
  });

  it("stops promptly when the shutdown signal fires", async () => {
    const { repos, config } = setup();
    const { logger } = collectingLogger();
    const controller = new AbortController();
    controller.abort();

    const processJob = vi.fn();
    await runWorker({
      repos,
      config,
      logger,
      processJob,
      signal: controller.signal,
      sleep: async () => {},
    });

    expect(processJob).not.toHaveBeenCalled();
    await repos.close();
  });

  it("returns a job abandoned by a crashed worker to the queue", async () => {
    const { repos, config } = setup();
    const { logger } = collectingLogger();
    await repos.enqueueJob({ id: "job_stale", kind: "github_sync_latest", payload_json: "{}" });
    // Simulate a worker that claimed the job and then died holding the lock.
    await repos.claimNextJob(new Date().toISOString());
    expect((await repos.getJob("job_stale"))?.state).toBe("running");

    // A later worker starts well past the stale-lock threshold.
    const restartedAt = Date.now() + 10 * 60_000;
    await runWorker({
      repos,
      config,
      logger,
      processJob: async () => ({ recovered: true }),
      maxIterations: 1,
      sleep: async () => {},
      now: () => restartedAt,
    });

    expect((await repos.getJob("job_stale"))?.state).toBe("succeeded");
    await repos.close();
  });
});

describe("worker logging", () => {
  it("never emits credential-bearing fields", () => {
    const records: CapturedLog[] = [];
    const lines: string[] = [];
    const logger = createLogger({
      level: "info",
      service: "greenlight-worker-test",
      write: (line) => lines.push(line),
      emit: (record) => records.push(record as CapturedLog),
    });

    logger.info("integration call", {
      apiKey: "signoz-secret-value",
      headers: { authorization: "Bearer super-secret" },
      nested: { password: "hunter2" },
      safe: "visible",
    });

    const line = lines[0];
    expect(line).not.toContain("signoz-secret-value");
    expect(line).not.toContain("super-secret");
    expect(line).not.toContain("hunter2");
    expect(line).toContain("visible");
    expect(records[0].fields).toMatchObject({ apiKey: "[redacted]", safe: "visible" });
  });

  it("normalises errors so a stack never reaches the log body", () => {
    const lines: string[] = [];
    const logger = createLogger({
      level: "info",
      service: "greenlight-worker-test",
      write: (line) => lines.push(line),
      emit: () => {},
    });

    logger.error("job failed", { err: new AppError("boom", "it broke", 500) });
    const parsed = JSON.parse(lines[0]);
    expect(parsed.err).toEqual({ name: "AppError", message: "it broke" });
  });
});
