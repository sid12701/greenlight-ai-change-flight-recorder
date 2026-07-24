import { createHash, timingSafeEqual } from "node:crypto";
import { parseApiKeys, type AppConfig, type ApiKey } from "../config.js";

export type Scope = "read" | "sync" | "deploy" | "evaluate" | "admin";

export interface Principal {
  id: string;
  scopes: Scope[];
}

/**
 * Compares two secrets in constant time.
 *
 * Both sides are hashed first so the comparison length never depends on the
 * secret length, which would otherwise leak it through timing.
 */
export function safeTokenEqual(left: string, right: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(left, "utf8").digest(),
    createHash("sha256").update(right, "utf8").digest(),
  );
}

/**
 * Parsing the key list on every request would be wasteful and would turn a
 * malformed value into a per-request failure. Config is immutable for the
 * process lifetime, so the parsed list is cached against it.
 */
const keyCache = new WeakMap<AppConfig, ApiKey[]>();

function configuredKeys(config: AppConfig): ApiKey[] {
  const cached = keyCache.get(config);
  if (cached) {
    return cached;
  }
  const parsed = parseApiKeys(config);
  keyCache.set(config, parsed);
  return parsed;
}

export function authenticate(
  authorization: string | undefined,
  config: AppConfig,
): Principal | null {
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }
  const token = authorization.slice("Bearer ".length);

  // Every candidate is compared so that the time taken does not reveal which
  // key matched, or how many keys precede it in the list.
  let principal: Principal | null = null;
  for (const candidate of configuredKeys(config)) {
    if (safeTokenEqual(token, candidate.key)) {
      principal = { id: candidate.id, scopes: candidate.scopes };
    }
  }

  // The static admin token is a local-development fallback only; `loadConfig`
  // rejects it outright when GREENLIGHT_ENV is production.
  if (config.GREENLIGHT_ADMIN_TOKEN && safeTokenEqual(token, config.GREENLIGHT_ADMIN_TOKEN)) {
    principal = { id: "local-admin", scopes: ["admin"] };
  }

  return principal;
}

export function hasScope(principal: Principal, required: Scope): boolean {
  return principal.scopes.includes("admin") || principal.scopes.includes(required);
}
