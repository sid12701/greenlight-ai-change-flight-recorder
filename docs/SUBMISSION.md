# Submission copy and final actions

Official deadline: **26 July 2026, 05:29 IST**.

## Paste-ready form fields

**Team name:** GreenLight

**Track:** Track 3 — Build Your Own

**GitHub:** https://github.com/sid12701/greenlight-ai-change-flight-recorder

**Deployed link:** leave blank; the verified demo is intentionally local

**YouTube demo:** https://www.youtube.com/watch?v=QiWLpvP3vXc

**Project blog:** paste the public URL after publishing
`greenlight-blog-post.md`

### Project description

GreenLight is a flight recorder for AI-authored change. It connects an AI
session, immutable commit, CI run, deployment, and the SigNoz telemetry that
followed, then produces an evidence receipt that says whether the version
regressed the service and whether a later version recovered it.

The recorded chain contains three real commits and three green CI runs. A
one-line Blnk connection-lifetime change passed all eight checks, but p95 on
`/balances` rose from 1.44 ms to 10.45 ms, a 7.3× regression. A later immutable
version measured 2.1 ms, so recovery is verified. Every published evidence link
must resolve, and missing AI-session evidence remains visibly missing.

### How GreenLight uses SigNoz

SigNoz is GreenLight’s evidence system. Query Builder v5 trace queries decide
version-scoped p90, p95, request count, and error rate. Three imported
dashboards compare deployments and observe GreenLight itself. Two
version-agnostic alert rules monitor p95 and true error rate; alert history
contains observed fired-and-resolved cycles. API and worker logs ship over OTLP
with trace context and `commit_sha`. Custom metrics report verdicts, AI-link
states, queue depth, dependency availability, and alert notifications.
GreenLight also queries SigNoz MCP over streamable HTTP; the recorded transcript
has no direct-query fallback and cites three trace IDs that resolve. The
self-hosted SigNoz stack is pinned by digest and verified at runtime.

### Hackathon experience

The most valuable lesson was that end-to-end verification changes the product,
not just the demo. Running the full chain exposed a load generator that measured
its own burst, a container health check that could never reach its target,
missing AI evidence mislabeled as malformed, and an early rehearsal that mixed
a dependency outage into the candidate window. The fixes all followed the same
principle: measure one thing at a time and state uncertainty instead of
explaining it away. That is why the final receipt reports version correlation,
never causation, and why unresolved AI and webhook evidence stays explicit.

## Do these three external actions now

1. Publish `greenlight-blog-post.md` on a proper blog platform. Upload the
   images from `assets/` and verify that the GitHub and video links open. Copy
   the public blog URL.
2. Upload `signoz-hackathon-end-to-end-demo.mp4` to YouTube as **Unlisted**.
   Confirm the displayed duration is 2:25, upload
   `assets/video/captions.srt`, and copy the public watch URL.
3. Open the official form, enter your email and submitter name, select Track 3,
   paste the fields above plus both public URLs, and submit once. Keep the
   emailed response copy.

Official form:
https://docs.google.com/forms/d/e/1FAIpQLSe8AwOr0mi40cj1fw2nXM7wokXwqROkYmkSXOSsSJj-ZIA0Kw/viewform?usp=send_form

## Do not claim

- Do not say the recorded commit has a linked Claude Code trace.
- Do not say SigNoz delivered an alert webhook; only rule firing/resolution and
  receiver behavior were observed.
- Do not show a populated service map; the current workload has no
  cross-service parent/child graph.
- Do not call the local demo publicly deployed.
