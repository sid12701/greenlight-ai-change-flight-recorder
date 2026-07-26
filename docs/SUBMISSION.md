# Submission

WeMakeDevs × SigNoz hackathon, **Track 3 — Build Your Own**. Submitted
26 July 2026.

| | |
|---|---|
| Repository | https://github.com/sid12701/greenlight-ai-change-flight-recorder |
| Demo video | https://www.youtube.com/watch?v=QiWLpvP3vXc (2:25) |
| Written story | [`greenlight-blog-post.md`](../greenlight-blog-post.md) |
| Deployed link | none — the verified demo is deliberately local |

## What it is

GreenLight is a flight recorder for AI-authored change. It connects an AI
session, an immutable commit, its CI run, the deployed version, and the SigNoz
telemetry that followed, then produces an evidence receipt stating whether that
version regressed the service and whether a later version recovered it.

The recorded chain contains three real commits and three green CI runs. A
one-line Blnk connection-lifetime change passed all eight checks, but p95 on
`/balances` rose from 1.44 ms to 10.45 ms — a 7.3× regression. A later immutable
version measured 2.1 ms, so recovery is verified. Every published evidence link
must resolve, and missing AI-session evidence stays visibly missing.

## Why this is Track 3

**GreenLight bridges a data source SigNoz does not support natively.** GitHub
Actions has no OpenTelemetry export: a workflow run is REST metadata, not spans.
GreenLight reconstructs each run as a trace — one root span per run, one child
per job, with real start and end times — and ships it over OTLP as service
`greenlight-ci`. That is what makes a CI run queryable next to the request
traces of the version it approved, in one backend, in one query language.

Everything else on the receipt is built on that bridge: once CI, deployment, and
production traffic are all spans in SigNoz, "which run approved this version,
and what did that version then do to latency?" becomes a single question rather
than four tools and a guess.

This is SigNoz's own Track 3 idea
[#11670 — *Novel integration: bridge an unsupported data source into SigNoz*](https://github.com/SigNoz/signoz/issues/11670).
The problem it solves is the one described in
[#11657 — *Deploy guardian*](https://github.com/SigNoz/signoz/issues/11657).

## How it uses SigNoz

SigNoz is GreenLight's evidence system, not a dashboard bolted on afterwards.
Remove SigNoz and there is no product: the verdict *is* a SigNoz query result,
and when SigNoz cannot answer, the receipt says `integration_error` rather than
passing the change.

- **Query Builder v5** trace queries decide version-scoped p90, p95, request
  count, and error rate.
- **Reconstructed CI traces** put GitHub Actions runs into SigNoz as spans —
  the bridge described above.
- **Three imported dashboards** compare deployments and observe GreenLight
  itself.
- **Two version-agnostic alert rules** monitor p95 and true error rate; alert
  history contains observed fired-and-resolved cycles.
- **API and worker logs** ship over OTLP with trace context and `commit_sha`.
- **Custom metrics** report verdicts, AI-link states, queue depth, dependency
  availability, and alert notifications.
- **SigNoz MCP** is queried over streamable HTTP; the recorded transcript has no
  direct-query fallback and cites three trace IDs that resolve.
- The self-hosted stack is **pinned by digest** and verified at runtime.

## What this project does not claim

- Commit `b24bf30` has a **verified** Claude Code session link: its trailer names
  a span that resolves in SigNoz. The three commits of the earlier recorded chain
  predate the procedure and read `missing`. See [`AI_LINK.md`](AI_LINK.md).
- SigNoz alert *rules* were observed firing and resolving. Webhook *delivery*
  to GreenLight was not observed end to end; only receiver behaviour was.
- The service map is not populated: the monitored workload has no cross-service
  parent/child graph.
- The demo is local. It is not publicly deployed.

## What the build taught

End-to-end verification changed the product, not just the demo. Running the
full chain exposed a load generator that measured its own burst, a container
health check that could never reach its target, missing AI evidence mislabelled
as malformed, and an early rehearsal that mixed a dependency outage into the
candidate window. Every fix followed one principle: measure one thing at a time,
and state uncertainty instead of explaining it away. That is why the receipt
reports version correlation and never causation.
