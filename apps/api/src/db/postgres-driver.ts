/**
 * PostgreSQL driver for shared and production deployments.
 *
 * The API and the worker are separate processes operating on the same state,
 * which a single-writer file store cannot serve. This driver runs the same
 * statements as the SQLite one, translated to positional parameters.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient } from "pg";
import type { SqlDriver } from "./driver.js";
import { bindPositional, toPositional, type SqlParameters } from "./sql.js";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "migrations", "postgres");

/** Anything that can run a query: the pool itself, or a pinned client. */
interface Queryable {
  query(text: string, values: Array<string | number | null>): Promise<{ rows: unknown[] }>;
}

export class PostgresDriver implements SqlDriver {
  private constructor(
    private readonly queryable: Queryable,
    private readonly pool: Pool | undefined,
    private readonly depth = 0,
  ) {}

  static async connect(connectionUrl: string): Promise<PostgresDriver> {
    const pool = new Pool({
      connectionString: connectionUrl,
      // The worker holds a connection for the length of a job, so the pool
      // must be large enough for concurrent jobs plus API reads.
      max: Number(process.env.GREENLIGHT_DATABASE_POOL_SIZE ?? 10),
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
    });
    const driver = new PostgresDriver(pool, pool);
    await driver.migrate();
    return driver;
  }

  /**
   * Applies pending migrations under an advisory lock so that several
   * processes starting at once cannot apply the same migration twice.
   */
  private async migrate(): Promise<void> {
    await this.run(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL
      )
    `);

    const client = await (this.pool as Pool).connect();
    try {
      await client.query("SELECT pg_advisory_lock($1)", [4_919_255_001]);
      const applied = new Set(
        (await client.query("SELECT name FROM schema_migrations", []))
          .rows.map((row) => (row as { name: string }).name),
      );
      for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
        if (applied.has(file)) {
          continue;
        }
        await client.query("BEGIN", []);
        try {
          await client.query(readFileSync(join(migrationsDir, file), "utf8"), []);
          await client.query(
            "INSERT INTO schema_migrations (name, applied_at) VALUES ($1, $2)",
            [file, new Date().toISOString()],
          );
          await client.query("COMMIT", []);
        } catch (error) {
          await client.query("ROLLBACK", []);
          throw error;
        }
      }
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [4_919_255_001]);
      client.release();
    }
  }

  private async query(sql: string, parameters: SqlParameters): Promise<unknown[]> {
    const statement = toPositional(sql);
    const result = await this.queryable.query(
      statement.text,
      bindPositional(statement, parameters),
    );
    return result.rows;
  }

  async get<TRow>(sql: string, parameters: SqlParameters = {}): Promise<TRow | undefined> {
    return (await this.query(sql, parameters))[0] as TRow | undefined;
  }

  async all<TRow>(sql: string, parameters: SqlParameters = {}): Promise<TRow[]> {
    return await this.query(sql, parameters) as TRow[];
  }

  async run(sql: string, parameters: SqlParameters = {}): Promise<void> {
    await this.query(sql, parameters);
  }

  /**
   * Pins one connection for the unit of work.
   *
   * Running a statement from the pool inside a transaction would take a
   * different connection and commit outside it, so the operation is handed a
   * driver bound to the pinned client.
   */
  async transaction<T>(operation: (tx: SqlDriver) => Promise<T>): Promise<T> {
    if (this.depth > 0) {
      const savepoint = `gl_sp_${this.depth}`;
      await this.queryable.query(`SAVEPOINT ${savepoint}`, []);
      const nested = new PostgresDriver(this.queryable, this.pool, this.depth + 1);
      try {
        const result = await operation(nested);
        await this.queryable.query(`RELEASE SAVEPOINT ${savepoint}`, []);
        return result;
      } catch (error) {
        await this.queryable.query(`ROLLBACK TO SAVEPOINT ${savepoint}`, []);
        await this.queryable.query(`RELEASE SAVEPOINT ${savepoint}`, []);
        throw error;
      }
    }

    const client: PoolClient = await (this.pool as Pool).connect();
    const bound = new PostgresDriver(client, this.pool, 1);
    try {
      await client.query("BEGIN");
      const result = await operation(bound);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool?.end();
  }
}
