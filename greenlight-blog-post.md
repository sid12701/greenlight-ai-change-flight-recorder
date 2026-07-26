# CI said green. Production said otherwise: what I learned building a change flight recorder on SigNoz

A one-line config change passed all eight of my CI checks. It was reviewed and
shipped. Production p95 on the affected endpoint then rose **7.3×**.

Nothing was broken in a way CI could see. The value parsed, the tests passed, the
container built. The failure lived in the gap between "the pipeline is green" and
"the change is safe."

This post is about closing that gap with SigNoz — and, more usefully, about the
four claims of mine that collapsed the first time I actually ran the whole thing
end to end. If you are wiring CI data into an observability backend, the mistakes
are the part worth your time.

- [Source code and reproducible setup](https://github.com/sid12701/greenlight-ai-change-flight-recorder)
- [2:25 demo video](https://www.youtube.com/watch?v=QiWLpvP3vXc)

## The one-line regression

Here is the change, on a real commit
[`2fa6e28`](https://github.com/sid12701/greenlight-ai-change-flight-recorder/commit/2fa6e2861eabf162a26af0d0ef012124865811df):

```diff
   "data_source": {
     "dns": "postgres://...",
     "max_open_conns": 20,
-    "max_idle_conns": 5
+    "max_idle_conns": 5,
+    "conn_max_lifetime": 1000000
   },
```

It reads like ordinary connection-pool tuning. But the service is
[Blnk](https://github.com/blnkfinance/blnk), written in Go, and a JSON number
decoded into `time.Duration` is interpreted as **nanoseconds**. `1000000` is not
roughly sixteen minutes. It is **one millisecond**. The pool threw away every
PostgreSQL connection almost as soon as it opened it.

Under measured traffic on `/balances`, p95 moved from **1.44 ms to 10.45 ms**. A
later revert measured **2.1 ms**.

I did not write this bug into a toy service. Blnk is a third-party Apache-2.0
ledger, fetched and checksum-verified at `v0.15.1`, and it knows nothing about my
tooling. That mattered more than I expected: a regression your own demo was built
to detect proves very little.

![Regression receipt showing the 7.3x p95 change](https://raw.githubusercontent.com/sid12701/greenlight-ai-change-flight-recorder/main/assets/screenshots/greenlight-regression-receipt.jpg)

## The part SigNoz does not do out of the box

The thing I actually had to build is a bridge. **GitHub Actions exports no
OpenTelemetry.** A workflow run is REST metadata — timestamps, conclusions, job
names — not spans. So a CI result and a production trace live in two different
systems and cannot be asked one question.

So I reconstruct each workflow run as a real trace: one root span per run, one
child span per job, with the actual start and end times from the API, exported
over OTLP as service `greenlight-ci`. Once CI runs, deployment markers, and
request traffic are all spans in one backend, "which run approved this exact
version, and what did that version then do to latency?" becomes a single query
instead of four browser tabs.

The unit of comparison is the **immutable deployed version**, not wall-clock time.
Every deployment reports its commit SHA as `service.version`, so every verdict
query is scoped like this:

```text
service.name = 'blnk-loan-workload'
  AND service.version = '<commit sha>'
  AND deployment.environment.name = 'hackathon-demo'
  AND http.route = '/balances'
```

That makes rollbacks and overlapping deploys unambiguous. A frozen baseline can
have been captured hours earlier and still refer to exactly one version.

![Architecture: how one change becomes evidence](https://raw.githubusercontent.com/sid12701/greenlight-ai-change-flight-recorder/main/assets/architecture/greenlight-architecture.png)

## Four things that broke when I ran it for real

This is the section I would have wanted to read.

**1. My load generator was measuring itself.** It accepted a duration flag but
never paced requests. Hundreds of calls finished almost instantly, Blnk's own rate
limiter rejected a chunk of them, and my "healthy" baseline showed an error rate
that the test tool had manufactured. I was benchmarking my own client. If your
baseline looks unhealthy before you change anything, suspect the harness first.

**2. My latency threshold silently exempted fast endpoints.** The original policy
required p95 to rise by 1.5× *and* by at least 250 ms — a number I picked because
it is roughly what a user notices. On a 1.44 ms route, that second condition means
the endpoint has to reach 251 ms. **A 174× regression would not have qualified.**
I replaced it with a 2 ms floor, which is a measurement-resolution guard rather
than a perception one. Absolute thresholds do not survive contact with fast
services.

**3. A container health check could never have passed.** The deployment worker
reached the host via `host.docker.internal`, while the origin allowlist only
permitted `127.0.0.1`. The fail-closed behaviour was correct; the configuration
had simply never been exercised through the real container path. Testing the
component is not testing the deployment.

**4. My first demo measured two things at once.** I injected a PostgreSQL outage
inside the candidate's measured window, so the verdict fired on an error rate that
had nothing to do with the config change. The honest fix was not better narration
— it was splitting the clean change chain and the dependency-failure scenario into
two separate, explicitly labelled runs. A verdict is only evidence about a change
if nothing else touched the service while it was being measured.

That last one is why every receipt now carries this line, and why it is
load-bearing rather than decorative:

> Deployment correlation is evidence of temporal and version association, not
> proof that every observed failure was caused by the commit.

## How each SigNoz signal earns its place

**Traces decide the verdict.** Two Query Builder v5 queries per window: one
returns count, p90 and p95; the other counts spans with `has_error = true` over
the same scope. One detail cost me an hour — SigNoz answers an empty window with a
zero count and *null* percentiles, and `Number(null)` is `0`. Coerced naively, "no
traffic" reads as "zero latency", which looks like a spectacular improvement. Null
and zero have to stay distinguishable.

**Dashboards make versions comparable.** The panel that matters groups p95 by
`service.version`, so baseline, candidate and recovery are three separate series.

![SigNoz Deployment Impact dashboard](https://raw.githubusercontent.com/sid12701/greenlight-ai-change-flight-recorder/main/assets/screenshots/signoz-deployment-impact-dashboard.jpg)

**Metrics describe decisions, which traces cannot.** A verdict is not a request,
and queue depth is a state rather than an event, so both are custom instruments —
`greenlight.regression.verdicts` counted by status, plus gauges for queue depth
and dependency health, observed on the export interval so an idle-but-healthy
system still reports.

![Custom verdict metric in SigNoz](https://raw.githubusercontent.com/sid12701/greenlight-ai-change-flight-recorder/main/assets/screenshots/signoz-verdict-metric.jpg)

**Alerts follow the deployed service, not a version.** Two rules — p95 and a true
error rate computed as a formula, `A/B*100`, over errored spans and all spans.
Deliberately *not* pinned to `service.version`: a version-pinned alert can only
describe a version that already existed when you wrote the rule.

![Observed p95 alert history](https://raw.githubusercontent.com/sid12701/greenlight-ai-change-flight-recorder/main/assets/screenshots/signoz-p95-alert-history.jpg)

**Logs carry the commit.** API and worker logs ship over OTLP with trace context,
and any job about a change also carries `commit_sha` — because an investigator
arrives holding a commit, not a queue job ID.

![Commit-correlated worker logs](https://raw.githubusercontent.com/sid12701/greenlight-ai-change-flight-recorder/main/assets/screenshots/signoz-correlated-logs.jpg)

**MCP answers the same question agent-natively.** I ask the SigNoz MCP server to
compare the two versions over streamable HTTP, with no direct-query fallback — if
MCP cannot answer, the capture fails and writes nothing. Over a wide 15-hour
window it reported 1.58 ms vs 9.39 ms, corroborating the receipt's narrower
1.44 → 10.45 ms. The error rates differ (0% vs 9.13%) because the wide window also
contains that dependency-failure rehearsal. Same version, different windows,
different correct answers — which is the entire argument for scoping a verdict to
the window you actually measured.

## Try it

Prerequisites are Node 24, Docker Compose v2, and SigNoz Foundry `v0.2.16`.

```bash
git clone https://github.com/sid12701/greenlight-ai-change-flight-recorder
cd greenlight-ai-change-flight-recorder
npm ci && cp .env.demo.example .env.demo
npm run demo:up
```

The first run pauses once, on purpose: SigNoz does not expose an API key through
automation, so you create a service-account key in the UI and re-run. Everything
else is scripted.

My last clean run on Node 24 passed lint, type-checking, every build, **241 tests**
(13 skipped), 24 receipt links, six runtime image-digest checks and three MCP trace
resolutions.

## What I would tell myself at the start

- **Verify end to end before you believe any number.** Every one of the four
  failures above survived unit tests and looked fine in isolation.
- **Absolute thresholds break on fast services.** Reach for ratios, and keep an
  absolute floor only as a resolution guard.
- **Measure one thing at a time**, or you have measured nothing you can attribute.
- **Say what you did not observe.** My alert rules fired and resolved, but I never
  watched SigNoz deliver the webhook end to end, so I do not claim it.

The AI link took longest to actually prove. Claude Code reads its telemetry
config at startup, so it cannot be switched on from inside a running session —
the exports have to be set in the shell that launches it. Once they were, commit
`b24bf30` carried an `AI-Traceparent` trailer naming span `95cf03c6c3e1413b`,
that span resolved in SigNoz, and its receipt reads **`AI link: verified`** with
a clickable *Verified Claude parent span*. The three earlier commits predate the
procedure and still read `missing` — which is the correct answer for them, and
why the receipt distinguishes `missing`, `invalid`, `failed` and `verified`
instead of collapsing them into a checkmark.

Remaining boundaries: the service map is empty because this workload has no
cross-service parent/child spans, and the demo is local rather than hosted.

## Closing

Observability cannot prove a commit caused an incident, and I would not trust a
tool that claimed otherwise. What it can do is make the available evidence
resolvable, version-scoped, and honest enough that a human — or an agent — starts
from facts instead of guesswork.

The code is [on GitHub](https://github.com/sid12701/greenlight-ai-change-flight-recorder),
MIT licensed. Blnk is Apache-2.0 and belongs to its authors.

**AI assistance disclosure:** Codex/ChatGPT and Claude Code were used for
planning, implementation, review and submission preparation, as allowed by the
[hackathon rules](https://www.wemakedevs.org/hackathons/signoz/rules). All commits
are reviewed and authored under my own Git identity. See
[PROVENANCE.md](https://github.com/sid12701/greenlight-ai-change-flight-recorder/blob/main/PROVENANCE.md).
