# A flight recorder for AI-authored change: building GreenLight on SigNoz

An AI wrote a config change. It passed all eight CI checks. It was reviewed,
merged, and deployed. Median latency on the affected endpoint then more than
doubled.

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
against the previous release, p50 on `/balances` went from 3.6 ms to 8.5 ms.

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

## Four ways GreenLight uses SigNoz

### 1. Traces answer the verdict

The evaluation is two Query Builder v5 queries in one round trip: query `A`
returns count, p90 and p95 for the version scope; query `B` returns the error
count for the same scope with `has_error = true`. A verdict needs both.

The thresholds are deliberately conservative and stated on every receipt:

| Guard | Rule |
|---|---|
| Latency | observed p95 > baseline × 1.5 **and** > baseline + 250 ms |
| Error rate | observed ≥ baseline + 2pp **and** ≥ 5% absolute |
| Data | ≥ 200 completed spans in **both** windows |

The additive 250 ms guard is why this run's verdict fired on error rate and not
latency. A p95 of 1.44 ms rising to 8.17 ms is a 5.7× regression — real, and
visible on the receipt — but on an endpoint this fast it is only 6.7 ms in
absolute terms. Firing a latency alarm on that would produce a system nobody
trusts. The receipt shows the number and the verdict withholds the claim.

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

### 3. Logs join the story back together

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

### 4. MCP asks the questions an agent would

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

In the recorded run, the error-rate regression came from a genuine PostgreSQL
outage inside the candidate's measured window. GreenLight reports what it
measured against the version that was deployed. It does not assert the commit
caused it — because it can't know that, and a tool that overstates once is a
tool you check manually forever after.

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

Measured: p95 **1.44 ms → 8.17 ms**, error rate **0% → 38.67%**, 257 and 256
requests in the two windows.

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
