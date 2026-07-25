import { createHash, timingSafeEqual } from "node:crypto";
import { parseApiKeys, type AppConfig, type ApiKey } from "../config.js";

export type Scope = "read" | "sync" | "deploy" | "evaluate" | "notify" | "admin";

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

/**
 * Extracts the presented secret from either supported scheme.
 *
 * Bearer is what GreenLight's own clients use. Basic exists because SigNoz's
 * webhook notification channel offers no other way to authenticate itself: it
 * sends a username and password and no custom headers. The username carries the
 * key's id and the password carries the key, so a webhook credential is an
 * ordinary scoped API key rather than a second kind of secret to manage.
 */
function presentedSecret(authorization: string): string | null {
  if (authorization.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }
  if (authorization.startsWith("Basic ")) {
    const decoded = Buffer.from(authorization.slice("Basic ".length), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    return separator === -1 ? null : decoded.slice(separator + 1);
  }
  return null;
}

export function authenticate(
  authorization: string | undefined,
  config: AppConfig,
): Principal | null {
  const token = authorization ? presentedSecret(authorization) : null;
  if (token === null || token === "") {
    return null;
  }

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
