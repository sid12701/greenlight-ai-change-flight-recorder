# A flight recorder for AI-authored change: building GreenLight on SigNoz

An AI wrote a config change. It passed all eight CI checks. It was reviewed,
merged, and deployed. p95 latency on the affected endpoint then rose 7.3x.

Nothing was broken in a way CI could see, because nothing CI tests was wrong.
That gap — between "the pipeline is green" and "production is fine" — is what
GreenLight exists to record.

This post is about how it's built on SigNoz, and about the parts that turned
out to be harder or more interesting than expected.

---

## The change that started it

Here is the entire diff that caused the regression:

```diff
   "data_source": {
     "dns": "postgres://...",
     "max_open_conns": 20,
-    "max_idle_conns": 5
+    "max_idle_conns": 5,
+    "conn_max_lifetime": 1000000
   },
```

It reads as "retire pooled database connections periodically", which is
ordinary, sensible tuning. The commit message says as much.

`conn_max_lifetime` is a Go `time.Duration`. Decoded from JSON, a
`time.Duration` is a count of **nanoseconds**. So `1000000` is not the
sixteen-and-a-bit minutes it looks like. It is **one millisecond**.

The service dutifully threw away every PostgreSQL connection almost the instant
it opened one, and spent its time reconnecting instead of serving. Measured
against the previous release, p95 on `/balances` went from 1.44 ms to 10.45 ms
and p90 from 1.19 ms to 8.71 ms.

No test catches this. There is no type error, no lint failure, no schema
violation. The value is a valid integer in a valid field. You find it in
production or you do not find it.

---

## What GreenLight records

GreenLight ties an AI-authored change to what happened after it shipped:

```
AI session ──▶ commit ──▶ CI run ──▶ deployment ──▶ telemetry window ──▶ verdict
```

Every link is an ID that has to resolve in a live SigNoz. If one doesn't, the
receipt says so rather than quietly rendering a blank.

The unit of comparison is the **immutable deployed version**. Each deployment
reports its commit SHA as `service.version`, and every query is scoped to it:

```
service.name = 'blnk-loan-workload'
  AND service.version = '<commit sha>'
  AND deployment.environment.name = 'hackathon-demo'
  AND http.route = '/balances'
```

That scope is the whole trick. "Before and after" as wall-clock time is
ambiguous — deploys overlap, rollbacks happen, traffic shifts. "Before and
after" as *version* is not.

---

## The monitored workload is somebody else's code

GreenLight monitors [Blnk](https://github.com/blnkfinance/blnk) `v0.15.1`, an
Apache-2.0 financial ledger, pinned to commit `c8fce93`. It is fetched and
verified at build time, never vendored, and a verification step proves the
checkout's origin, tag, SHA, and that the single approved OpenTelemetry patch
is its only modification.

This matters more than it sounds. If the demo workload were something I wrote,
"GreenLight detected a regression" would be a story about code written to be
detected. Blnk knows nothing about GreenLight. It emits OpenTelemetry because
it already did.

Two upstream realities had to be handled at the container boundary rather than
by patching: `v0.15.1` declares a `--config` flag but its pre-run hook reads
`./blnk.json` regardless, and PostHog and Typesense are disabled.

---

## Five ways GreenLight uses SigNoz

### 1. Traces answer the verdict

The evaluation is two Query Builder v5 queries in one round trip: query `A`
returns count, p90 and p95 for the version scope; query `B` returns the error
count for the same scope with `has_error = true`. A verdict needs both.

The thresholds are stated on every receipt, and the receipt records which
policy version decided it:

| Guard | Rule |
|---|---|
| Latency | observed p95 > baseline × 1.5 **and** > baseline + 2 ms |
| Error rate | observed ≥ baseline + 2pp **and** ≥ 5% absolute |
| Data | ≥ 200 completed spans in **both** windows |

That 2 ms floor is the interesting number, and it used to be 250 ms.

The floor exists to stop timer resolution and scheduling jitter from being
reported as a regression. 250 ms looks like the right value because it is roughly
where a human starts to notice — but choosing a *perceptible* duration makes the
guard scale-dependent, and it silently exempts every endpoint faster than it. On
a route whose baseline p95 is 1.44 ms, a 250 ms floor demands 251 ms before
latency may be reported at all: a 174× regression. Under that policy this run's
7.3× regression was measured, shown on the receipt, and excluded from the
verdict.

Policy v2 replaces the perception floor with a resolution floor. 2 ms is
comfortably above span timing granularity, so a rise clearing both it and the
1.5× multiplier is a real measured change at any service scale — and the
multiplier still suppresses small absolute rises on slow endpoints, which is what
the original floor was reaching for. Both policies stay in the codebase and every
stored verdict names the one that decided it, so an old receipt still explains
itself under the rules it was measured against.

### 2. Metrics answer what traces can't

A verdict is a decision, not a request. Queue depth and dependency health are
states, not events. Those needed real instruments:

| Metric | Type | What it answers |
|---|---|---|
| `greenlight.regression.verdicts` | counter | what has been decided, by status and route |
| `greenlight.change.ai_verification` | counter | how many changes carry a resolvable AI link |
| `greenlight.jobs.queue_depth` | gauge | is work stuck |
| `greenlight.dependency.available` | gauge | is GitHub, SigNoz, or the database down |

One detail worth stating: job counts report **zero** for states holding no
rows. A gauge that stops emitting looks exactly like a collector that stopped,
and telling those apart is the entire point of watching queue depth.

Integration failures are counted as outcomes too. If SigNoz can't answer, that
is recorded as `integration_error` — never as a verdict. Omitting it would make
the totals imply SigNoz always answered.

### 3. Alerts that can actually fire

Two rules, on p95 and on a true error rate — errored spans over all spans in one
Query Builder v5 formula, rather than a raw error count that would rise with
traffic alone. Both were broken in the same two ways, and both failures are
invisible from the UI:

**Dashboard variables do not exist for alert rules.** A filter written as
`service.name = $service` is stored verbatim, accepted, listed, and matches
nothing. The rule looks configured and can never fire. The assets now declare
their scope in a `variables` block that GreenLight expands before posting, and
the validator rejects any rule that still contains a `$` after compilation.

**A version-pinned alert is a contradiction.** Scoping a rule to one immutable
`service.version` means it can only ever describe a version that already existed
when the rule was written — so it cannot warn about the next deployment, which is
the only thing an alert is for. The rules follow the environment and route;
deciding what a specific version did is the receipt's job.

The p95 threshold sits at 5 ms: above this route's healthy 1.4 ms and below the
~10 ms the regression produces, so it separates them rather than restating
either. Under load on the candidate the rule goes `inactive` → `firing`, and back
to `inactive` on the revert.

One thing did not work, and it is worth reporting because the alternative is
implying it did. SigNoz refuses to store a rule with no notification channel, so
the importer provisions one pointing at an authenticated GreenLight receiver. The
receiver works — the SigNoz container reaches it, is rejected without credentials
and accepted with them, and records each notification as a log with trace context
and as a metric. But with a rule firing continuously for several minutes, no
webhook call ever arrived. The channel is what makes the rules storable; delivery
is unproven, and saying so costs less than being found out.

### 4. Logs join the story back together

API and worker logs ship to SigNoz over OTLP carrying trace context, so a log
line resolves to its span. Worker jobs that name a commit carry `commit_sha`,
because someone investigating an incident arrives holding a commit, not a job
ID.

```
commit_sha = c65cd730b405…  →  "job succeeded"  →  trace 5f892180…
  ├─ deployment.started      (blnk-loan-workload)
  └─ job deployment_record   (greenlight-worker)
```

No commit is invented for job kinds that don't reference one. An absent
`commit_sha` means the job genuinely wasn't about a single commit.

### 5. MCP asks the questions an agent would

Rather than only calling the query API, GreenLight asks the SigNoz MCP server
the same questions an investigating agent would, over streamable HTTP, and
records the answers:

| | baseline `6f458c9` | candidate `2fa6e28` |
|---|---|---|
| p95 | 1.59 ms | 8.31 ms |
| error rate | 0% | 32.89% |

Three trace IDs are cited and each one resolves. The capture has **no**
direct-API fallback: if MCP can't answer, it fails and writes nothing, because
a transcript that didn't come from MCP would misrepresent what it claims to be.

These numbers are gathered independently of the receipt's own evaluation and
over a wider window, so they corroborate the verdict instead of restating it.

---

## Three things that were wrong and only running it revealed

**The load generator was measuring itself.** It accepted a `--duration-seconds`
flag and never used it to pace anything. 250 requests finished in under
0.2 seconds, the workload's own rate limiter rejected 90 of them, and a
"healthy" baseline reported a 36% error rate that belonged entirely to the load
tool. A baseline captured from that traffic would have described the generator,
not the service, and every downstream verdict would have inherited it.

**The deployment API could never have worked in containers.** The API performs
its own health check before recording a deployment, and it runs in a container
that reaches the host through `host.docker.internal` — but the health-origin
allowlist permitted only `http://127.0.0.1:18081`, which inside that container
is the container. It failed closed, correctly, and had presumably never been
exercised in the containerised path.

**Absent evidence was reported as invalid evidence.** The AI-link parser
returns a *result object* for a missing trailer rather than a null, so a
`parsed ? "invalid" : "missing"` expression always chose `invalid` and the
`missing` branch was unreachable. Every commit without an AI trailer was
recorded as having a malformed one — telling a reader the commit tried to
record an AI session and got it wrong, which is a claim there was no evidence
for. For a project whose whole purpose is not overstating evidence, that was
the worst bug of the three.

---

## What it refuses to say

Every receipt carries this, and it is load-bearing:

> Deployment correlation is evidence of temporal and version association, not
> proof that every observed failure was caused by the commit.

That sentence earned its place. An earlier version of the demo injected a real
PostgreSQL outage inside the candidate's measured window, and the verdict fired
on the resulting error rate rather than on the latency the commit actually
caused. Everything was disclosed and nothing was fabricated — but the headline
claim was "this change regressed the service", and the mechanism behind the
verdict was something else entirely. A tool that overstates once is a tool you
check manually forever after, and that applies to the demo as much as to the
product.

So the two are now separate runs. `demo-chain.mjs` measures what a version did
and injects nothing; it asserts nothing about the candidate's traffic either,
because deciding what observed failures mean is the evaluator's job.
`demo-dependency-failure.mjs` deliberately stops the workload's database inside
the window and exists to show the opposite case: GreenLight reports the failures
it measured against the version that was running, and refuses to attribute them
to a commit that never touched that dependency.

The same restraint shows up in smaller places. A percentage change from a zero
baseline returns null rather than "Infinity%". An unknown CI conclusion stays
neutral instead of being guessed. `insufficient_data` and `integration_error`
are distinct outcomes, and neither is allowed to masquerade as "healthy".

---

## The recorded chain

Three real commits, three real CI runs, three version-verified deployments:

| Phase | Commit | CI | Verdict |
|---|---|---|---|
| Baseline | `6f458c9` | ✅ | frozen |
| Candidate | `2fa6e28` | ✅ **all 8 checks** | **regressed** |
| Recovery | `c65cd73` | ✅ | **recovered** |

Measured on `/balances`: p95 **1.44 ms → 10.45 ms**, a 7.3× rise, with 257 and
260 completed spans in the two windows and no errors in either. The verdict fires on that latency change, caused
by the deployed version, and on nothing else.

The candidate passing every CI check is not an embarrassment to report. It is
the premise. The pipeline was working exactly as designed; the thing that was
wrong was not the kind of thing a pipeline can see.

---

## Try it

```bash
git clone https://github.com/sid12701/greenlight-ai-change-flight-recorder
cd greenlight-ai-change-flight-recorder
cp .env.demo.example .env.demo    # two external credentials
npm run demo:up                   # health-gated: SigNoz, workload, API, web
```

The whole stack is pinned by manifest digest — SigNoz `v0.134.0`, its collector
`v0.144.6`, MCP `v0.9.0` — and a runtime verifier asserts every running
container matches its pin before the demo is allowed to claim anything.

MIT licensed. The workload is Apache-2.0 and belongs to someone else, which is
rather the point.
