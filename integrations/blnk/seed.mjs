#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { DEFAULT_BASE_URL, seedWorkload } from "./workload.mjs";

async function main() {
  const key = process.env.BLNK_DEMO_KEY?.trim();
  if (!key) {
    throw new Error("BLNK_DEMO_KEY is required");
  }
  const result = await seedWorkload({
    baseUrl: process.env.BLNK_BASE_URL ?? DEFAULT_BASE_URL,
    key,
    stateFile:
      process.env.BLNK_SEED_STATE ??
      resolve(import.meta.dirname, "../../.workloads/blnk-seed.json"),
  });
  console.log(JSON.stringify(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`blnk-seed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  });
}
