#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "greenlight-migration-"));
const databasePath = join(directory, "compiled.db");
try {
  const result = spawnSync(process.execPath, ["apps/api/dist/db/migrate-cli.js"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, GREENLIGHT_DATABASE_PATH: databasePath },
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "compiled migration failed");
  }
  const database = new DatabaseSync(databasePath);
  const migrations = database
    .prepare("SELECT name FROM schema_migrations ORDER BY name")
    .all()
    .map((row) => row.name);
  database.close();
  if (
    !migrations.includes("001_initial.sql") ||
    !migrations.includes("002_verified_evidence.sql") ||
    !migrations.includes("003_job_results.sql") ||
    !migrations.includes("004_pipeline_receipt_details.sql")
  ) {
    throw new Error(`compiled migrations incomplete: ${migrations.join(", ")}`);
  }
  console.log(`compiled-migration-smoke: applied ${migrations.join(", ")}`);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
