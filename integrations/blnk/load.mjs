#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { parseLoadArgs, runLoad } from "./workload.mjs";

async function main() {
  const options = parseLoadArgs(process.argv.slice(2));
  const result = await runLoad(options);
  console.log(JSON.stringify({ profile: options.profile, ...result }));
  const incomplete = result.attempted < result.requested;
  const unexpectedHealthyFailure =
    options.profile === "healthy" &&
    (result.applicationErrors > 0 || result.transportErrors > 0);
  const missingExpectedFailure =
    options.profile !== "healthy" &&
    (result.applicationErrors === 0 || result.transportErrors > 0);
  if (incomplete || unexpectedHealthyFailure || missingExpectedFailure) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`blnk-load: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  });
}
