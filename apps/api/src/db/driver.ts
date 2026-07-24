/**
 * The seam between GreenLight's persistence logic and a specific database.
 *
 * Every statement and every rule about how rows relate lives once, in
 * `Repositories`. A driver only knows how to run a statement and how to make
 * a set of statements atomic, so adding a database means implementing four
 * methods rather than restating the schema.
 */
import type { SqlParameters } from "./sql.js";

export interface SqlDriver {
  /** Runs a statement that returns at most one row. */
  get<TRow>(sql: string, parameters?: SqlParameters): Promise<TRow | undefined>;

  /** Runs a statement that returns any number of rows. */
  all<TRow>(sql: string, parameters?: SqlParameters): Promise<TRow[]>;

  /** Runs a statement for its effect. */
  run(sql: string, parameters?: SqlParameters): Promise<void>;

  /**
   * Runs `operation` as one atomic unit of work.
   *
   * The driver passed to `operation` is bound to the transaction. Using the
   * outer driver inside it would run the statement on a different connection
   * and silently escape the transaction, so callers must use the one they are
   * given.
   *
   * Nesting is supported through savepoints: an inner failure rolls back only
   * the inner scope.
   */
  transaction<T>(operation: (tx: SqlDriver) => Promise<T>): Promise<T>;

  close(): Promise<void>;
}
