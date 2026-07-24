/**
 * Chooses the storage driver a process should use.
 *
 * Selection is explicit: a configured database URL means a networked store,
 * its absence means the local file store. Silently downgrading from one to
 * the other would give a deployment a database that does not survive a
 * restart and cannot be shared between the API and the worker.
 */
import { Repositories } from "./repositories/index.js";
import { PostgresDriver } from "./postgres-driver.js";
import { SqliteDriver } from "./sqlite-driver.js";

export class UnsupportedStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedStoreError";
  }
}

export interface StoreOptions {
  /** Local file path, used when no connection URL is configured. */
  databasePath: string;
  /** Connection URL for a networked store. */
  connectionUrl?: string;
}

const SUPPORTED_PROTOCOLS = new Set(["postgres:", "postgresql:"]);

export async function createRepositories(options: StoreOptions): Promise<Repositories> {
  if (!options.connectionUrl) {
    return Repositories.create(options.databasePath);
  }

  let protocol: string;
  try {
    protocol = new URL(options.connectionUrl).protocol;
  } catch {
    throw new UnsupportedStoreError("GREENLIGHT_DATABASE_URL is not a valid URL");
  }
  if (!SUPPORTED_PROTOCOLS.has(protocol)) {
    throw new UnsupportedStoreError(
      `GREENLIGHT_DATABASE_URL uses "${protocol.replace(":", "")}", which this build does not support. ` +
      "Supported: postgres.",
    );
  }
  return new Repositories(await PostgresDriver.connect(options.connectionUrl));
}

export { Repositories, SqliteDriver, PostgresDriver };
