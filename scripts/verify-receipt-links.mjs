#!/usr/bin/env node
/**
 * Asserts that every link a receipt publishes actually opens.
 *
 * GreenLight's central claim is that each link in an evidence chain is an ID
 * that resolves in a live SigNoz. That claim is only as good as the origin the
 * links are built from, and an origin is a deployment detail no unit test can
 * check: an API running in a container reaches SigNoz over the Docker host
 * gateway, and a link built from that origin resolves nowhere in a reader's
 * browser. The failure is invisible from inside the API and obvious to anyone
 * who clicks.
 *
 * So this runs from the outside, the way a reader does: fetch the receipts,
 * collect every URL they publish, and require each one to answer.
 *
 *   node scripts/verify-receipt-links.mjs
 *
 * GitHub links are checked for shape only. They are public URLs on a third
 * party's service, and failing a local preflight because github.com rate
 * limited an unauthenticated HEAD would report the wrong problem.
 */
import { readEnvFile, ROOT, config } from "./lib/demo-runtime.mjs";
import { join } from "node:path";

const API_BASE = process.env.GREENLIGHT_API_BASE ?? config.apiBase;
const REQUEST_TIMEOUT_MS = 10_000;

const log = (message) => console.log(`verify-receipt-links: ${message}`);

/** Reads are unauthenticated in the local demo, but honour a token if present. */
const token = readEnvFile(join(ROOT, ".workloads/greenlight.env"))
  .get("GREENLIGHT_ADMIN_TOKEN") ?? "";

async function getJson(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`GET ${path} -> ${response.status}`);
  }
  return response.json();
}

/** Every URL a receipt puts in front of a reader, with where it came from. */
function publishedLinks(receipt) {
  const links = [];
  const add = (source, url) => {
    if (typeof url === "string" && url.length > 0) {
      links.push({ source, url });
    }
  };

  add("pipeline.htmlUrl", receipt.pipeline?.htmlUrl);
  add("pipeline.signozTraceUrl", receipt.pipeline?.signozTraceUrl);
  add("change.githubUrl", receipt.change?.githubUrl);
  for (const [index, item] of (receipt.evidence ?? []).entries()) {
    add(`evidence[${index}] ${item.kind}`, item.url);
  }
  return links;
}

/**
 * Resolves one link, or explains why it does not.
 *
 * A DNS failure is reported distinctly from an HTTP error because they mean
 * different things: the first says the origin is wrong for this reader, the
 * second says the resource is missing.
 */
async function checkLink(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: "is not a valid URL" };
  }

  if (parsed.hostname.endsWith("github.com")) {
    return { ok: true, reason: "github.com (shape checked, not fetched)" };
  }

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return response.status < 400
      ? { ok: true, reason: `HTTP ${response.status}` }
      : { ok: false, reason: `HTTP ${response.status}` };
  } catch (error) {
    const cause = error instanceof Error ? (error.cause ?? error) : error;
    const code = cause && typeof cause === "object" && "code" in cause ? cause.code : null;
    if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
      return {
        ok: false,
        reason:
          `host "${parsed.hostname}" does not resolve for a reader. ` +
          "Set SIGNOZ_PUBLIC_URL to an origin reachable outside the container.",
      };
    }
    return { ok: false, reason: cause instanceof Error ? cause.message : String(cause) };
  }
}

async function main() {
  const { changes } = await getJson("/api/v1/changes");
  if (!Array.isArray(changes) || changes.length === 0) {
    throw new Error("no changes are recorded, so there are no links to verify");
  }

  const failures = [];
  let checked = 0;

  for (const change of changes) {
    const receipt = await getJson(`/api/v1/changes/${change.commitSha}`);
    for (const { source, url } of publishedLinks(receipt)) {
      const result = await checkLink(url);
      checked += 1;
      if (result.ok) {
        log(`ok   ${change.shortSha} ${source} -> ${result.reason}`);
      } else {
        log(`FAIL ${change.shortSha} ${source} -> ${url}: ${result.reason}`);
        failures.push({ commit: change.shortSha, source, url, reason: result.reason });
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `${failures.length} of ${checked} published links did not resolve`,
    );
  }
  log(`all ${checked} published links resolve across ${changes.length} receipts`);
}

main().catch((error) => {
  console.error(`verify-receipt-links: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
