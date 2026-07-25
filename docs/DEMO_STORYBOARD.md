# GreenLight demo storyboard

Runtime: **2:25**. Format: **1920×1080 H.264 + AAC**. Track:
**Track 3 — Build Your Own**.

The final edit is a concise narrated walkthrough of evidence captured from the
live local stack. The narration source and captions are committed so the public
upload can be reproduced or corrected without re-inventing the story.

## Pre-recording setup

1. Start the stack with `npm run demo:up`.
2. Require all five checks from `npm run demo:status`.
3. Run `npm run verify:receipt-links`.
4. Load `.env.demo` and run `npm run mcp:verify`.
5. Confirm the receipt still reports candidate `2fa6e28` as `regressed` and
   recovery `c65cd73` as verified.
6. Set SigNoz dashboard windows to include only the recorded baseline,
   candidate, and recovery traffic.
7. Collapse unrelated service filters before capturing logs.
8. Never show `.env.demo`, `.workloads/signoz.env`, API keys, passwords, or
   unrelated project data.

## Scene plan

| Time | Objective | Screen and action | What the viewer should understand | SigNoz evidence | Narration emphasis |
|---|---|---|---|---|---|
| 0:00–0:13 | Establish the problem | GreenLight overview; hold on “CI said green. Production said otherwise.” | CI success does not prove production safety. | The overview links to the live SigNoz-backed receipt. | One line passed every check; p95 rose 7.3×. |
| 0:13–0:31 | Introduce the product and its truth boundary | Regression receipt, verdict and missing AI-link line visible. | GreenLight connects a change chain and keeps absent evidence visibly absent. | Receipt evidence is assembled from SigNoz traces, logs, metrics, and CI spans. | “Not linked” is an explicit state, not a hidden failure. |
| 0:31–0:49 | Show the measured result | Receipt Impact section: p95, errors, samples, and recovery. | The finding has numbers, scope, minimum sample counts, and a measured recovery. | Query Builder v5 measurements scoped to immutable `service.version`. | 1.4 → 10.4 ms, zero errors, 257/260 spans, recovery at 2.1 ms. |
| 0:49–1:05 | Explain architecture | Full architecture diagram. | React/Fastify/worker deploy Blnk; OpenTelemetry feeds self-hosted SigNoz; SigNoz feeds evidence back. | Collector, SigNoz `v0.134.0`, MCP `v0.9.0`, dashboards and alert history. | Evidence-first architecture and no causal overclaim. |
| 1:05–1:23 | Prove version comparison | Deployment Impact dashboard, 12-hour clean window. | Baseline, candidate, and recovery are separate immutable series. | p95 grouped by `service.version`; no error data in the clean measured scenario. | Empty error panels are honest because this was latency-only. |
| 1:23–1:36 | Resolve a concrete trace | Direct slow-trace view. | Evidence links lead to inspectable telemetry, not screenshots or invented IDs. | Trace `cfecce61fc730d03113f3f8e40c2ee00`: 83 ms, two spans, zero errors. | 78.77 ms database child span. |
| 1:36–1:51 | Show an alert lifecycle | p95 alert History view. | The rule really fired and later resolved. | Four observed Fired/Resolved cycles; average resolution 5.3 minutes. | The rule follows the deployed service instead of pinning an old version. |
| 1:51–2:04 | Join logs to a change | Logs Explorer filtered by `greenlight-worker` and recovery SHA. | A commit can be followed through retries, permanent failure, and success. | OTLP logs with trace context and `commit_sha`. | Investigators start with commits, not queue IDs. |
| 2:04–2:16 | Show self-observability | GreenLight Self Observability dashboard. | The evidence service watches its own API and health signals. | API request rate and p95 plus custom `greenlight.*` metrics. | Three dashboards, two rules, traces, metrics, logs, and MCP. |
| 2:16–2:25 | Close with the complete chain | Return to GreenLight overview. | Small, complete, reproducible proof beats a broad unverified claim. | Three commits, three CI runs, three deployments, regression and recovery. | Track 3 — Build Your Own. |

## Expected product behavior

- The overview reports one recorded chain and a live receipt.
- The receipt reports `Regressed`, 7.3×, zero measured errors, and verified
  recovery.
- The AI session state reads `Not linked`.
- The Deployment Impact dashboard shows baseline `6f458c9`, candidate
  `2fa6e28`, and recovery `c65cd73`.
- The cited trace opens with two spans and no error.
- Alert history contains Fired and Resolved rows.
- The log query returns commit-correlated worker jobs.

## Backup plan

All final screens are stored under `assets/screenshots/`. If the live stack is
unavailable during upload or re-editing, rebuild from those assets rather than
changing the numbers or implying a fresh run. The images were captured only
after the corresponding live checks passed.
