#!/usr/bin/env node
/**
 * Captures the demo's backup assets from the running stack.
 *
 * A live demo can fail for reasons that have nothing to do with the project —
 * a laptop sleeping, a port already bound, a projector losing signal — and the
 * three-minute limit leaves no room to debug it. These are the stills the
 * narration can be read over instead.
 *
 * They are captured by script rather than by hand so they can be regenerated
 * whenever the interface changes, which is the only way they stay truthful.
 * Each shot also records how long the page took to become useful, so a demo
 * that has quietly become slow is visible before it is performed.
 *
 * Usage: node scripts/capture-demo-assets.mjs [commit-sha]
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = join(ROOT, "audit", "screenshots");
const BASE_URL = process.env.DEMO_BASE_URL ?? "http://127.0.0.1:4173";
const COMMIT_SHA = process.argv[2] ?? "2fa6e2861eabf162a26af0d0ef012124865811df";

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

/** The shots the narration in docs/VIDEO_SCRIPT.md walks through, in order. */
const SHOTS = [
  { name: "01-landing", path: "/", viewport: DESKTOP, waitFor: "text=System readiness" },
  { name: "02-change-list", path: "/changes", viewport: DESKTOP, waitFor: "h1" },
  { name: "03-receipt", path: `/changes/${COMMIT_SHA}`, viewport: DESKTOP, waitFor: "h1", fullPage: true },
  { name: "04-receipt-mobile", path: `/changes/${COMMIT_SHA}`, viewport: MOBILE, waitFor: "h1" },
  {
    name: "05-receipt-missing",
    path: "/changes/0000000000000000000000000000000000000000",
    viewport: DESKTOP,
    waitFor: "[role=alert]",
  },
];

mkdirSync(OUTPUT, { recursive: true });

const browser = await chromium.launch();
const failures = [];

try {
  for (const shot of SHOTS) {
    const context = await browser.newContext({ viewport: shot.viewport });
    const page = await context.newPage();
    const startedAt = Date.now();
    try {
      await page.goto(`${BASE_URL}${shot.path}`, { waitUntil: "networkidle", timeout: 20_000 });
      await page.waitForSelector(shot.waitFor, { timeout: 10_000 });
      const elapsed = Date.now() - startedAt;
      await page.screenshot({
        path: join(OUTPUT, `${shot.name}.png`),
        fullPage: Boolean(shot.fullPage),
      });
      console.log(`capture-demo-assets: ${shot.name} (${elapsed}ms)`);
    } catch (error) {
      // One unreachable page must not cost the whole set; the rest are still
      // worth having, and the failure is reported rather than swallowed.
      failures.push(`${shot.name}: ${error instanceof Error ? error.message : error}`);
      console.error(`capture-demo-assets: ${shot.name} FAILED`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error("capture-demo-assets: incomplete\n  " + failures.join("\n  "));
  process.exitCode = 1;
} else {
  console.log(`capture-demo-assets: ${SHOTS.length} assets written to audit/screenshots`);
}
