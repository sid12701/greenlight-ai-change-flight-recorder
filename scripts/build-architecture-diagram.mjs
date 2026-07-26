#!/usr/bin/env node
/**
 * Renders assets/architecture/greenlight-architecture.{png,svg}.
 *
 * The diagram is a sequence diagram: five lifelines, and every message on it is
 * a real call made during the recorded run. Layout is computed from the message
 * list in scripts/lib/architecture-diagram.html rather than hand-placed, so a
 * message can be added or reworded without two labels colliding or an arrow
 * crossing another.
 *
 * assets/architecture/greenlight-architecture.mmd carries the same sequence in
 * Mermaid, for readers who want a diffable source rather than a render.
 *
 *   node scripts/build-architecture-diagram.mjs
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "scripts", "lib", "architecture-diagram.html");
const out = join(root, "assets", "architecture");

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1920, height: 1360 },
  deviceScaleFactor: 2,
});
await page.goto(`file://${source}`);
await page.waitForSelector("svg");
await page.screenshot({ path: join(out, "greenlight-architecture.png") });

const svg = await page.$eval("svg", (node) => node.outerHTML);
writeFileSync(
  join(out, "greenlight-architecture.svg"),
  `<?xml version="1.0" encoding="UTF-8"?>\n${svg.replace(
    "<svg",
    '<svg xmlns="http://www.w3.org/2000/svg"',
  )}\n`,
);

await browser.close();
console.log("architecture diagram: wrote greenlight-architecture.png and .svg");
