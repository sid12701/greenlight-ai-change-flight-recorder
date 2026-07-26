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

## How it uses SigNoz

SigNoz is GreenLight's evidence system, not a dashboard bolted on afterwards.

- **Query Builder v5** trace queries decide version-scoped p90, p95, request
  count, and error rate.
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

- No recorded commit has a linked Claude Code trace. See
  [`AI_LINK.md`](AI_LINK.md).
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
