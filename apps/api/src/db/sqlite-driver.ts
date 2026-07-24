/**
 * SQLite driver for local development and tests.
 *
 * `node:sqlite` is synchronous; the async surface exists so that persistence
 * logic is written once against `SqlDriver` and does not have to know which
 * database is underneath.
 */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SqlDriver } from "./driver.js";
import { toNamed, type SqlParameters } from "./sql.js";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "migrations");

export function openSqlite(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  return db;
}

export function migrateSqlite(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    db.prepare("SELECT name FROM schema_migrations ORDER BY id")
      .all()
      .map((row) => (row as { name: string }).name),
  );

  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    if (applied.has(file)) {
      continue;
    }
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(readFileSync(join(migrationsDir, file), "utf8"));
      db.prepare("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)")
        .run(file, new Date().toISOString());
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}

export class SqliteDriver implements SqlDriver {
  private depth = 0;

  constructor(private readonly db: DatabaseSync) {}

  static open(path: string): SqliteDriver {
    mkdirSync(dirname(path), { recursive: true });
    const db = openSqlite(path);
    migrateSqlite(db);
    return new SqliteDriver(db);
  }

  private statement(sql: string) {
    return this.db.prepare(toNamed(sql));
  }

  async get<TRow>(sql: string, parameters: SqlParameters = {}): Promise<TRow | undefined> {
    return this.statement(sql).get(parameters) as TRow | undefined;
  }

  async all<TRow>(sql: string, parameters: SqlParameters = {}): Promise<TRow[]> {
    return this.statement(sql).all(parameters) as TRow[];
  }

  async run(sql: string, parameters: SqlParameters = {}): Promise<void> {
    this.statement(sql).run(parameters);
  }

  /**
   * SQLite holds one connection, so the transaction driver is this driver.
   * Nesting uses savepoints so an inner failure does not discard outer work.
   */
  async transaction<T>(operation: (tx: SqlDriver) => Promise<T>): Promise<T> {
    if (this.depth > 0) {
      const savepoint = `gl_sp_${this.depth}`;
      this.db.exec(`SAVEPOINT ${savepoint}`);
      this.depth += 1;
      try {
        const result = await operation(this);
        this.db.exec(`RELEASE ${savepoint}`);
        return result;
      } catch (error) {
        this.db.exec(`ROLLBACK TO ${savepoint}`);
        this.db.exec(`RELEASE ${savepoint}`);
        throw error;
      } finally {
        this.depth -= 1;
      }
    }

    this.db.exec("BEGIN IMMEDIATE");
    this.depth = 1;
    try {
      const result = await operation(this);
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    } finally {
      this.depth = 0;
    }
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
