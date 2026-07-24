/**
 * Local SQLite schema management.
 *
 * Retained for the migration CLI and the compiled-artifact smoke tests, which
 * operate on a file database directly. Application code selects its store
 * through `createRepositories` in `store.ts`.
 */
import type { DatabaseSync } from "node:sqlite";
import { migrateSqlite, openSqlite, SqliteDriver } from "./sqlite-driver.js";

export type Database = DatabaseSync;

export const openDatabase = openSqlite;
export const migrate = migrateSqlite;

/** Opens a migrated local database, for the migration CLI and smoke tests. */
export function createDatabase(path: string): DatabaseSync {
  const driver = SqliteDriver.open(path);
  return (driver as unknown as { db: DatabaseSync }).db;
}
