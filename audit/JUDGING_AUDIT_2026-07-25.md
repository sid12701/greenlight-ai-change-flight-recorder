# GreenLight — Hackathon Judging Audit (run-verified)

Audit date: **25 July 2026**, ~16:00–17:30 IST
Auditor stance: six-judge panel, adversarial, evidence-only
Method: the running stack was exercised, not read about. Every claim below cites
a command, an HTTP response, a ClickHouse row, a rendered page, or a file/line.

**This document supersedes `audit/HACKATHON_AUDIT.md`**, which was written against
an earlier state where the stack could not be started. That file is now stale and
actively harmful (see Blocker B6).

---

## 0. Event facts (confirmed from the official page)

Source: <https://www.wemakedevs.org/hackathons/signoz> ("Agents of SigNoz",
WeMakeDevs × SigNoz).

**Confirmed:**

| Fact | Value |
|---|---|
| Dates | 20 – 26 July 2026 |
| Prize pool | $20,000 |
| Tracks | 01 AI & Agent Observability · 02 Signals & Dashboards · 03 Build Your Own |
| Track 03 prize | iPhone Air per team member (max 4), or cash equivalent |
| Judging criteria | Potential Impact · Creativity & Innovation · Technical Excellence · Best Use of SigNoz · User Experience · Presentation Quality |
| Hard requirement | "Every project must use or integrate with SigNoz" |
| Submission | Google Form |
| Bonus | Top blogs → job interviews at SigNoz; top 10 social posts → swag |

**Not published (therefore assumption, labelled as such):**

- **No criterion weights are published.** This audit uses **equal weight (1/6 each)**
  and labels the scorecard an estimate. Do not treat the weighting as official.
- **No published "overall winner" category.** The three tracks appear to be
  independent prizes. Any "overall hackathon win" probability below is a
  hypothetical best-of-panel figure, not a real prize.
- The FAQ *questions* are published; the *answers* are not rendered on the page.
  Eligibility, prior-work rules, and AI-assistant rules could not be verified.
  **Action: confirm the prior-work rule in the SigNoz Slack before submitting** —
  this repo was created 23 July 2026 (inside the window), so it should be fine,
  but get it on the record.
- Exact deadline time/timezone is not published. `docs/SUBMISSION.md` asserts
  26 July 05:29 IST. **Verify this against the form itself.** If wrong in the
  pessimistic direction, everything below has to fit in a much smaller window.

Track fit is correct: this is **Track 03 — Build Your Own**. It has a legitimate
claim on Track 01 too (agent-native observability, MCP, coding-agent traces), but
Track 03 is the better-differentiated field.

---

## 1. What was actually run

All of the following was executed during this audit.

| Action | Result |
|---|---|
| `npm run verify` (clean, lint, typecheck, test, build) | **exit 0** |
| Test totals | **202 passing, 13 skipped**, 0 failing (24 shared + 128 api + 40 web + 23 node:test) |
| `npm run demo:status` | 5/5 healthy: SigNoz, MCP, Blnk, API, Web |
| `docker ps` | 14 containers up; SigNoz v0.134.0, collector v0.144.6, MCP v0.9.0 |
| `GET /readyz` | `{"status":"ready","checks":{"database":"ok"}}` |
| `GET /api/v1/changes` | 3 changes returned |
| `GET /api/v1/changes/2fa6e28…` | full receipt, verdict `regressed` |
| Web UI, 7 routes, 1440px + 390px | rendered, screenshotted, zero console errors |
| SigNoz dashboards API | 3 dashboards, 14 panels — confirmed present |
| SigNoz rules API | 2 alert rules — confirmed present, both `inactive` |
| ClickHouse `signoz_metrics` | all 4 `greenlight.*` metrics confirmed present |
| ClickHouse `signoz_logs` | 1,041 API + 134 worker log records confirmed |
| ClickHouse `signoz_traces` | blnk-loan-workload 16,713 · greenlight-api 3,112 · greenlight-ci 805 · greenlight-worker 36 |
| `npm run mcp:verify` (with key) | 3 trace IDs resolve, 2 spans each |
| `gh pr checks 64` | **8/8 green** — the README claim is accurate |
| Repo visibility | **public**, MIT, `casting.yaml` + `.lock` present |

**Verdict on the "does it run" question: yes.** This is a working system, not a
slide deck. That already puts it in the top decile of hackathon submissions. The
problems below are not "it doesn't work" problems — they are "the demo
undermines its own story" problems, which at this level is the more dangerous
category.

---

## 2. The single most dangerous finding

### F1 — The headline regression is produced by the demo script stopping PostgreSQL

`scripts/demo-chain.mjs:302-310`, inside the candidate deployment phase:

```js
duringWindow: async () => {
  await sleep(20_000);
  log("candidate: stopping the workload's PostgreSQL dependency");
  await compose("stop", "postgres");
  await sleep(30_000);
  log("candidate: restoring PostgreSQL");
  await compose("start", "postgres");
},
```

and `scripts/demo-chain.mjs:171`:

```js
if (expect === "mixed" && counts.applicationErrors === 0) {
  throw new Error("the outage window recorded no failed requests");
}
```

The recorded verdict for `2fa6e28` is `regressed`, and its **only** reason is:

> `"Observed error rate exceeded baseline by 2pp and reached at least 5%"`

That error rate (0% → 38.67%) is the demo script killing the workload's database
for 30 seconds inside the measured window. It has nothing to do with the commit.

Meanwhile the effect the commit **genuinely did** cause — p95 **1.44 ms → 8.17 ms**,
a 5.7× regression — is explicitly excluded from the verdict by
`apps/api/src/modules/regressions/evaluator.ts:126`:

```js
const latencyRegressed =
  observedP95 > baselineP95 * thresholds.latencyMultiplier &&   // 8.17 > 2.16  ✅
  observedP95 > baselineP95 + thresholds.latencyAdditiveMs;      // 8.17 > 251.4 ❌
```

So the demo currently has this shape:

> **The real signal is discarded by policy, and the verdict fires on an injected failure.**

Everything narrative-facing — README first paragraph, `docs/BLOG.md` first
paragraph, `docs/VIDEO_SCRIPT.md` 0:00–0:22, the submission description — says the
AI's config change caused the regression. The mechanism says otherwise.

**Why this is the top item:** the project's entire brand is evidentiary restraint.
This is the one place where the framing does not match the mechanism. A judge who
opens `demo-chain.mjs` — a plausible thing to do for a project selling
"verifiable evidence" — reads a comment block explaining that the outage was
deliberately induced, and the honest disclosure in the README ("came from a
genuine PostgreSQL outage") reads in hindsight as passive-voice softening.
That reframes every other honest disclosure as spin. This is the kind of finding
that takes a submission from finalist to rejected in ninety seconds.

**Why it's also the best news in this audit:** the fix is small and turns the
weakness into the strongest possible proof. See Blocker B1.

---

## 3. Confirmed defects, ranked

### B1 — Latency policy makes the genuine regression unreportable
**Severity: critical · Effort: ~30 min · Risk: low**

`latencyAdditiveMs: 250` (`evaluator.ts:23`) is a sensible guard for a
request-scale service and a nonsense guard for a 1.4 ms endpoint. It requires an
absolute +250 ms rise on a route whose baseline p95 is 1.44 ms — i.e. a 174×
regression before latency may be reported. The consequence is F1.

### B2 — Every SigNoz evidence link on the flagship receipt is dead
**Severity: critical · Effort: ~45 min · Risk: low**

Confirmed by rendering the page. The candidate receipt emits:

```
http://host.docker.internal:8080/trace/e110b0cbb4d1fc17ef853f746868e666
http://host.docker.internal:8080/trace/b36f83968fa184fa11e11136ed0e4bf3
http://host.docker.internal:8080/trace/2d9f33c6b81799d9c83a5ab3b6fb6c96
http://host.docker.internal:8080/trace/31c0fe89e6dda920dc31f76dd8aeac24
```

```
$ ping -c1 host.docker.internal
ping: cannot resolve host.docker.internal: Unknown host
$ curl -o /dev/null -w "%{http_code}" http://host.docker.internal:8080/
000
```

Root cause: `apps/api/src/modules/signoz/client.ts:303` builds links from
`this.baseUrl`, which is the API container's `SIGNOZ_URL`
(`deploy/compose.local.yaml:38`), not a browser-reachable origin.

**This is the worst bug relative to the pitch.** The README's thesis sentence is
*"Every link is an ID that must resolve in a live SigNoz."* Four of them do not
resolve in the judge's browser. If a judge clicks one on camera, the demo is over.

### B3 — The receipt timeline reports "CI: failed" when CI passed
**Severity: critical · Effort: ~15 min · Risk: none**

`apps/web/src/features/receipts/EvidenceTimeline.tsx:16`:

```tsx
{stage === "CI" && (receipt.pipeline?.exportState ?? "missing")}
```

The CI node renders the **telemetry export state**, not the CI conclusion. The
receipt's own `pipeline.conclusion` is `success` and PR #64 is 8/8 green, yet the
timeline — the visual centrepiece of the receipt — reads **`CI: failed`** on all
three changes. This directly contradicts the pitch's premise ("it passed all
eight CI checks"). A judge reading the screen concludes either the demo is broken
or the story is false.

### B4 — CI trace reconstruction is broken: three runs, one trace, all unverified
**Severity: high · Effort: 2–3 h · Risk: medium**

Database (`pipeline_runs`):

| run | change | conclusion | export_state | emitted_trace_id |
|---|---|---|---|---|
| `run_30151964468` | `chg_c65cd730b405` | success | **failed** | `17985286c153eaa9f39a824a9fd21b5a` |
| `run_30150651642` | `chg_2fa6e2861eab` | success | **failed** | `17985286c153eaa9f39a824a9fd21b5a` |
| `run_30150421905` | `chg_6f458c91ccfd` | success | **failed** | `17985286c153eaa9f39a824a9fd21b5a` |

`export_error` on all three: `"Reconstructed trace tree was not visible in SigNoz"`.

Three distinct CI runs cannot legitimately share one trace ID. And in ClickHouse:

```
trace_id                            min(ts)               max(ts)               spans
ef92d2fcf09c3aced59dc195372ec824    08:03:28              08:58:31              255
a9d986f5d4243e7bc494bd72adbea17a    08:03:28              08:58:31              255
17985286c153eaa9f39a824a9fd21b5a    08:03:28              08:58:31              255
```

Actual run `30150651642` ran **08:11:06 → 08:13:14** (7 jobs, 2m08s). Each
"per-run" trace instead spans **55 minutes** and contains **all three runs'
spans merged**. So verification — correctly bounded to one run's real time range
plus margin — sees fewer spans than the 255 it expects, returns false, and marks
the export failed. The verification logic is right; the synthesis is wrong.

Consequences: the `AI → GitHub → reconstructed CI spans → GreenLight` edge in the
README architecture diagram is unproven; the CI trace link is withheld on every
receipt; and B3 renders that as "CI: failed".

### B5 — Both SigNoz alert rules are inert
**Severity: high · Effort: ~1 h · Risk: low**

Fetched live from `GET /api/v1/rules`:

```
GreenLight — candidate error rate high   (inactive)
  A -> service.name = $service AND service.version = $version AND … AND has_error = true
  B -> service.name = $service AND service.version = $version AND …
  F1 -> A/B*100                       target: 6 %
GreenLight — candidate p95 regression    (inactive)
  A -> service.name = $service AND service.version = $version AND …
                                      target: 500000000 ns
```

Two independent reasons neither rule can ever fire:

1. **`$service` / `$version` / `$environment` / `$route` are stored unsubstituted.**
   SigNoz alert rules do not carry dashboard-style text variables; these filters
   match nothing.
2. **The p95 threshold is 500 ms** against a workload whose p95 is 8 ms — a 60×
   gap. Even substituted, it could not fire.

The error-rate rule's `A/B*100` formula is genuinely good work (and there is a
test asserting a traffic-count query can't masquerade as an error rate —
`scripts/signoz-assets.test.mjs`). But shipped as-is, alerts are decorative.
"Alerts" is named explicitly in the *Best Use of SigNoz* criterion.

### B6 — A committed file tells judges the project is not submission-ready
**Severity: high · Effort: 10 min · Risk: none**

`audit/HACKATHON_AUDIT.md` is tracked and public. It contains:

> **Current judging score: 64/100.**
> **Current submission readiness: No.**
> "The current artifact is **not submission-ready** and would be risky to demo to judges."

It was accurate when written and is stale now, but a judge browsing the repo has
no way to know that. This is a self-inflicted wound.

### B7 — The landing page opens by announcing the demo is incomplete
**Severity: high · Effort: follows from B8 · Risk: low**

First screen a judge sees, in amber:

> **3 change(s) recorded, but none has a complete chain yet.**
> A chain is complete when the AI session, CI run, deployment, and regression
> verdict all resolve. Produce one with: `node scripts/demo-chain.mjs …`

`apps/web/src/features/landing/featured.ts:26` requires
`aiVerificationState === "verified"` for completeness. That is never true (B8),
so the landing page is permanently in its failure state and the featured-receipt
feature never activates. The judge's first impression of a project about
verifiable evidence is a notice saying nothing is verified.

### B8 — The AI link — the product's headline noun — is `missing` on every change
**Severity: high · Effort: 1–2 h · Risk: medium**

```
$ curl -s :4000/api/v1/changes | jq '.changes[].aiVerificationState'
"missing" "missing" "missing"
```

ClickHouse: `service.name = 'claude-code'` → **0 spans**.

The product is "a flight recorder for AI-authored change"; the changes list shows
a red **`AI: Missing`** badge on all three rows; the receipt's first line under
the title is *"AI link: missing (No AI session trace was attached to this commit)"*.

The README and blog disclose this honestly, and the restraint is admirable. But
the criterion judges score is *demonstrated capability*, and the AI→commit link —
the thing that makes this project different from every other deployment-guardian
submission — is demonstrated **zero times**.

The mechanism is fully built and unexercised: `instrumentation/git-hooks/prepare-commit-msg`
injects `AI-Traceparent:` from `$TRACEPARENT`;
`instrumentation/claude-code/env.example` has the Claude Code OTEL exports;
`worker-runtime.ts:232-245` verifies the exact span against SigNoz with a ±24 h
window. Nothing is missing except one commit made inside an instrumented session.

### B9 — `npm run mcp:verify` reports success without verifying anything
**Severity: medium · Effort: 15 min · Risk: none**

```
$ npm run mcp:verify
verify-mcp-result: SIGNOZ_API_KEY not set — trace IDs were format-checked but not resolved
verify-mcp-result: fixture validation passed          ← exit 0
```

With the key sourced it does the real thing (3 traces resolve, 2 spans each). But
the README lists `npm run mcp:verify` in the "verify this claim" table without
mentioning the key, so a judge who runs the documented command gets a green
"passed" that proves nothing. That is precisely the failure mode this project
exists to prevent, shipped in its own verification tooling.

### B10 — The submitted blog contains an impossible measurement
**Severity: medium · Effort: 5 min · Risk: none**

`docs/BLOG.md:39`: *"p50 on `/balances` went from 3.6 ms to 8.5 ms."*

The receipt reports baseline **p90 = 1.185 ms** and **p95 = 1.439 ms**. A p50 of
3.6 ms is arithmetically impossible alongside a p90 of 1.185 ms. The same figure
propagates to the README opener ("Median latency… more than doubled") and the
video script, where median is never measured. On a project whose differentiator
is numerical honesty, a cross-checkable false number in the *submitted blog* is
disproportionately damaging.

### B11 — Dashboards open empty and can't tell the story
**Severity: medium · Effort: 1–2 h · Risk: low**

`signoz/dashboards/deployment-impact.json`:

- `version` variable defaults to **`c8fce93af4df6b1edb46ca97e570c55beff4cef9`** —
  the upstream *Blnk* commit, which was never deployed as a `service.version`.
  **A judge who opens the flagship dashboard sees empty panels.**
- All five panels filter to a **single** version, so baseline and candidate can
  never appear on the same chart. There is no `group by service.version` panel —
  the single most persuasive visual available to this project does not exist.
- No `yAxisUnit` on any panel: latency renders as `1000000`, `3000000`
  (nanoseconds). Confirmed in the shipped screenshot
  `audit/screenshots/07-signoz-deployment-dashboard.png`.
- Default range is 6 h against ~90 s of data, so the series is a vertical sliver
  at the right edge and "Error count" reads as empty.

### B12 — A foreign service pollutes the demo SigNoz
**Severity: medium · Effort: 15 min · Risk: low**

```
blnk-loan-workload  16713
lms-backend         14692   ← unrelated project
greenlight-api       3112
greenlight-ci         805
greenlight-worker      36
greenlight-smoke       17
```

`lms-backend` is a different project of yours sharing this SigNoz. On the SigNoz
services list — a screen judges *will* look at — it is the second-largest service
and has nothing to do with the submission. There is also a tracked
`instrumentation/lms-java-agent/env.example` in the repo for the same foreign
project.

### B13 — E2E tests exist but do not gate anything on PRs
**Severity: low · Effort: 10 min · Risk: low**

`.github/workflows/e2e-smoke.yml` is `workflow_dispatch:` only. (The `browser`
job in `ci.yml` does run `test:e2e:smoke`, so coverage exists — but the standalone
workflow is dead weight that invites the question "why two?")

### B14 — Minor UI/a11y gaps
**Severity: low · Effort: 30 min · Risk: none**

Structurally the UI is good: `<main>`/`<header>`/`<nav>` landmarks, correct h1→h2→h3
order, `lang="en"`, no unnamed links or buttons, no missing `alt`, zero console
errors on every route, and a genuinely excellent error-state system
(`apps/web/src/failures.ts` maps each API failure kind to its own next step).
Gaps:

- `document.title` is `"GreenLight"` on every route — receipts are
  indistinguishable in tabs, history, and to a screen reader.
- No `aria-live` region: the async-loaded verdict is never announced.
- No skip link.
- Recovery and baseline receipts carry **no** SigNoz trace evidence at all — only
  the candidate has any, and those are the broken ones (B2).

---

## 4. What is genuinely strong (and must be protected)

Stated plainly so the criticism above is read in proportion. Compared to a
typical hackathon field, this is exceptional:

1. **The monitored workload is third-party.** Blnk v0.15.1 @ `c8fce93`, Apache-2.0,
   fetched and hash-verified rather than vendored. It knows nothing about
   GreenLight. This kills the "you wrote the bug to be found" objection outright,
   and almost no competing submission will have thought of it.
2. **The bug is genuinely good.** `conn_max_lifetime: 1000000` as a Go
   `time.Duration` decodes to **1 ms**, not ~16 minutes. Valid integer, valid
   field, no type error, no lint failure, no test catches it. This is a real
   class of production incident, not a contrived `sleep(500)`.
3. **Version-scoped comparison.** Every query pins
   `service.version = <commit sha>`, so before/after is a version comparison, not
   an ambiguous wall-clock one. This is the correct architectural idea and it is
   correctly implemented.
4. **CI that most production repos don't have.** 8 green checks: actions pinned by
   commit SHA, `permissions: contents: read`, Trivy HIGH/CRITICAL gate on three
   images, CycloneDX SBOM, `npm audit --omit=dev --audit-level=low`, a grep gate
   for credentials compiled into the web bundle, enforced non-root UIDs
   (65532/65532/101), and an `if: always()` aggregate gate that can't be skipped.
5. **Config discipline.** `apps/api/src/config.ts` rejects placeholder secrets by
   regex, validates origins structurally, requires PostgreSQL *and*
   `GREENLIGHT_REQUIRE_READ_AUTH` in production, and refuses the static admin
   token there. `http/auth.ts` compares every candidate key in constant time so
   timing reveals neither which key matched nor its position.
6. **Failure taxonomy that survives to the screen.** `insufficient_data`,
   `integration_error`, and `healthy` are distinct outcomes and none may
   impersonate another. Queue-depth gauges emit **zero** for drained states, so a
   stopped collector is distinguishable from an empty queue. Percentage change
   from a zero baseline returns `null`, not `Infinity%`.
7. **MCP is real.** `test/fixtures/signoz/mcp-investigation.json` records
   `SigNozMCP v0.9.0` over streamable HTTP, tool `signoz_aggregate_traces`, and
   the capture has no direct-API fallback by design. All three cited trace IDs
   resolve.
8. **The whole stack is digest-pinned** and verified at runtime before the demo
   may claim anything (`scripts/signoz-runtime-verify.sh`, 6 images by digest).
9. **The writing is excellent.** `docs/BLOG.md`'s "three things that were wrong
   and only running it revealed" section is better technical writing than most
   engineering blogs, and the third item — reporting absent evidence as invalid
   evidence — is exactly the self-criticism that earns trust.

---

## 5. Judging scorecard

> **Estimate.** The organisers publish six criteria and **no weights**. Equal
> weighting (1/6 each) is this audit's assumption, not an organiser statement.

| # | Criterion (official) | Weight | Now | After fixes | Evidence driving the score |
|---|---|---|---|---|---|
| 1 | Potential Impact | 16.7% | **8.5** | 8.5 | Real, current, under-served problem; the "green CI, broken prod" gap is exactly the SigNoz thesis |
| 2 | Creativity & Innovation | 16.7% | **8.5** | 8.5 | "Change receipt" framing, version-scoped comparison, third-party workload, evidence that refuses to overclaim |
| 3 | Technical Excellence | 16.7% | **7.5** | 8.5 | 202 tests, 8 CI gates, SBOM+Trivy, dual DB drivers, constant-time auth — minus B2/B3/B4 |
| 4 | Best Use of SigNoz | 16.7% | **6.5** | 8.5 | Traces/metrics/logs/dashboards/alerts/MCP all present — but alerts inert (B5), dashboards empty by default (B11), CI spans unverified (B4) |
| 5 | User Experience | 16.7% | **6.0** | 8.0 | Clean, responsive, superb error states — undone by "none has a complete chain", "AI: Missing", "CI: failed", dead links |
| 6 | Presentation Quality | 16.7% | **5.5** | 8.5 | README/blog excellent, but **video unrecorded**, **blog unpublished**, impossible p50 (B10), self-damning audit file (B6) |
| | **Total** | 100% | **71 / 100** | **84 / 100** | |

### Supplementary dimensions (not official criteria — auditor's own read)

| Dimension | Now | Note |
|---|---|---|
| Problem clarity & importance | 9/10 | Best-in-class framing |
| Technical difficulty | 8/10 | Genuinely hard: version-scoped windows, CI reconstruction, MCP, digest pinning |
| Implementation completeness | 7/10 | Complete except the three links that matter most (AI, CI trace, evidence URL) |
| Reliability & production readiness | 8/10 | Strongest category; prod config refusal is rare at hackathon level |
| Scalability & extensibility | 7/10 | Postgres path, job queue, policy versioning all present; single-route hardcoding limits it |
| Documentation & ease of setup | 7/10 | Excellent docs, honestly-disclosed manual gate; 46 docs files is over-documented |
| Live-demo quality | 4/10 | **Weakest.** Broken links, "CI failed", inert alerts, empty dashboards |
| Storytelling | 6/10 | Script is strong; the artifact contradicts it in four visible places |
| Rules compliance | 6/10 | Repo/track/`casting.yaml` ✅; **blog and video not yet delivered** |
| Differentiation | 9/10 | Third-party workload + AI-session linkage is a field-of-one position |

---

## 6. Panel verdicts

### Judge 1 — Technical architecture · **7.5 / 10**

**First impression.** "This person has shipped software before." Workspace layout,
shared contracts package, dual SQLite/Postgres drivers with parallel migration
sets, a real job queue with attempts and deadlines, pure-function verdict logic
separated from I/O. The comment density is unusual — comments explain *why*, not
*what* (`evaluator.ts` header, `auth.ts` on constant-time comparison,
`sync.ts:236` on not carrying a trace ID forward across attempts).

**Values.** Version-scoped comparison as the core abstraction. Policy thresholds
persisted per evaluation (`regression_evaluations.thresholds_json`) so a receipt
stays reproducible after the policy changes. Integration failure handled *before*
the evaluator, so a missing metric always means "no data" and never "SigNoz was
down".

**Questions.** "Why do three CI runs share one trace ID?" (B4) — and there is no
good answer. "Why is route `/balances` hardcoded through the demo path?" "Why 46
files in `docs/` plus an 87 KB `GREENLIGHT_IMPLEMENTATION_PLAN.md` and a 34 KB
`remediation-list.md` at repo root?" — planning artefacts shipped as product.

**Downgrade triggers.** B4 is the one that lands: the architecture diagram claims
an edge the data disproves. Secondary: `relatedPipelines: []` on every receipt —
a modelled feature with no instance.

**Final.** "The bones are better than the hackathon average by a wide margin. One
subsystem — CI reconstruction — is genuinely broken and it happens to be one of
the five edges on the architecture diagram. Fix that and I'd score this 8.5."

### Judge 2 — SigNoz / observability expert · **6.5 / 10**

**First impression.** Cautiously impressed. Query Builder **v5** with a formula
alert, digest-pinned Foundry stack, MCP over streamable HTTP, `has_error = true`
for the error scope, and a **test that rejects a traffic-count query disguised as
an error rate**. That last one is a detail only someone who has been burned writes.

**Values.** That the four custom metrics answer things traces structurally cannot
— verdicts by status/route, AI verification state, queue depth, dependency
availability. That queue depth emits zero rather than going silent. That
`integration_error` is counted as an outcome so the totals don't imply SigNoz
always answered.

**Questions.** "Open the alerts." → both `inactive`, filters containing literal
`$service` / `$version`, p95 target 500 ms against an 8 ms service (B5). "Open
the Deployment Impact dashboard." → empty, because the default version variable
is the upstream Blnk SHA (B11). "Show me baseline and candidate on one chart." →
not possible; no panel groups by `service.version`. "Why is latency in
nanoseconds?" "Why does the services list show `lms-backend`?" (B12)

**Downgrade triggers.** The alerts. This judge will open them, and inert alert
rules in a submission scored on *Best Use of SigNoz* read as box-ticking. Second:
`claude-code` has **zero spans**, so the most SigNoz-native idea in the project —
a coding-agent trace joined to a production trace — is asserted, never shown.

**Final.** "The depth is real — this is the top quartile for SigNoz usage and the
MCP work is ahead of the field. But the parts I'd screenshot for a write-up are
the parts that don't work. Make one alert fire live during the demo and put both
versions on one chart, and this is an 8.5 for me."

### Judge 3 — Product & UX · **6.0 / 10**

**First impression.** Loads instantly, clean dark theme, confident typography, no
console errors, mobile at 390 px is genuinely good. Then: *"3 change(s) recorded,
but none has a complete chain yet."* — the first sentence of substance tells me
the demo isn't finished.

**Values.** `apps/web/src/failures.ts` — every API failure kind gets its own title,
cause, and single next step, with a copyable command or a link. "No receipt exists
for this commit" explains *why* and offers the way back. Most hackathon UIs render
a spinner forever. The verdict banner is well-designed: verdict first, then the
two numbers that justify it, then the recovery pointer.

**Questions.** "Why is 'AI: Missing' red on every row when the product is *about*
AI-authored change?" "Why does the timeline say CI failed when the pitch says CI
passed?" "Why does clicking 'Slow trace 1' go nowhere?"

**Downgrade triggers.** Three of the six timeline nodes read as failure states
(`Claude: missing`, `CI: failed`, plus a withheld link). Dead evidence links. The
landing page's featured-receipt feature is dark code — it can never activate.

**Final.** "The craft is here — the error states alone are better than most
production apps I use. But the app's own status indicators tell me the story in
the README didn't happen. Make the happy path actually reach green and this is an
8."

### Judge 4 — Business value & innovation · **8.5 / 10**

**First impression.** "Oh, this is a real product." AI-authored change volume is
exploding, attribution is genuinely unsolved, and "a receipt per change" is a
crisp, sellable primitive.

**Values.** That the monitored workload is somebody else's Apache-2.0 code —
that single decision is worth more than any feature, because it pre-empts the
first objection. That the system states what it refuses to conclude; in the
compliance/audit market that restraint *is* the product. That the receipt ends
with a safe action (`git revert <sha>`) rather than a dashboard.

**Questions.** "Who buys this — platform teams, or the AI-coding vendors?" "What
happens with ten deploys an hour and overlapping windows?" "How is the baseline
chosen in a real pipeline rather than by a demo script?"

**Downgrade triggers.** Few. If told the headline regression was induced by
stopping Postgres (F1), the reaction is "then show me the latency one — that's
the better story anyway, and it's real."

**Final.** "The strongest idea I expect to see in this track. The gap is between
the idea and the artifact, not in the idea. This is a company, and it's being
demoed as a script."

### Judge 5 — Security & production readiness · **8.0 / 10**

**First impression.** Genuinely surprised — this is the best-secured hackathon repo
this judge will see. Actions pinned by commit SHA with the reason written in a
comment. `permissions: contents: read`. Trivy on all three images with
`exit-code: 1`. CycloneDX SBOM as an artifact. `npm audit --omit=dev
--audit-level=low`. A grep gate that fails the build if a bearer token or `ghp_`
is compiled into the web bundle. Enforced non-root UIDs.

**Values.** `config.ts` refusing to boot in production without PostgreSQL and
`GREENLIGHT_REQUIRE_READ_AUTH`, and refusing the static admin token there at all.
A placeholder-secret regex. Constant-time comparison across *every* configured key.
Structural origin validation rejecting embedded credentials. `.gitignore` covering
`.env*`, `.workloads/`, `*.db`; live secrets confirmed untracked and mode 0600.

**Questions.** "Rate limit is 120/min and max-concurrency 50 — measured or
guessed?" "The demo binds every port to `127.0.0.1` — is that enforced or
convention?" "`GITHUB_TOKEN` defaults to empty string — does a missing token
degrade or fail loudly?"

**Downgrade triggers.** Almost none in-scope. `npm run mcp:verify` passing without
credentials (B9) is a soft-fail pattern this judge dislikes on principle.

**Final.** "I'd merge most of this CI config into a production repo tomorrow. This
is the category where the project is unambiguously excellent, and it's the
category nobody will notice unless it's said out loud — say it out loud."

### Judge 6 — Demo & storytelling · **4.5 / 10**

**First impression.** The *script* is excellent — the 0:00–0:22 cold open (eight
green checks, then latency doubles) is the best opening in the field. Then:
**there is no video and no published blog.** Both are submission deliverables.
`docs/SUBMISSION.md` marks them "needs recording" / "needs publishing".

**Values.** The narrative arc: green CI → shipped → regressed → receipt →
recovered. The one-line diff as the hero shot. That the caveat is read aloud —
it's a memorable beat, and no other submission will do it.

**Questions.** "You said it passed CI; your own screen says CI failed." "You said
every link resolves; that one didn't." "You said the change caused this — your
script stopped the database."

**Downgrade triggers.** All three above are single-sentence demo-enders, and each
is currently guaranteed to be visible on screen. Add: the flagship dashboard
opens empty, and the alerts never fire.

**Final.** "Right now the demo's own screens contradict the narration in four
places. That's fatal in a three-minute video where I can't ask a follow-up. Fix
those four and this becomes the best story in the track — the material is
already written."

**Panel mean: 6.9 / 10 → 69–71 / 100.**

---

## 7. Competitive position

**Is it submission-ready?** *Almost.* The repo qualifies today (public, MIT,
Track 3, `casting.yaml` + lock, working stack). But **two hard deliverables are
missing — the published blog and the ≤3-minute video** — and the demo currently
contradicts itself on screen. Submitting as-is is a mid-field entry.

**Is it finalist-quality?** *The idea and engineering are. The artifact isn't yet.*
Roughly 6 hours of the fixes in §8 makes it so.

**Can it realistically win Track 3?** *Yes*, and it is well-positioned. The
third-party-workload decision and the AI-session linkage are a field-of-one
position. Winning requires the demo to stop undermining itself.

**Best-fit track.** **Track 03 — Build Your Own** (correct, keep it).
**Track 01 — AI & Agent Observability** is a legitimate alternative *only if* B8
is fixed (a genuinely verified `claude-code` span). Without that, Track 01 judges
would find the AI half unproven and score it lower. Stay on Track 3.

### Why it could win
1. Nobody else will monitor **someone else's** production code — it pre-empts the
   sharpest objection available to a judge.
2. The bug is a real production-incident archetype, not a contrived slowdown.
3. Version-scoped before/after is the technically correct answer and is correctly
   implemented.
4. SigNoz is load-bearing: remove it and there is no verdict, no evidence, no
   product. That is exactly what "Best Use of SigNoz" is asking for.
5. The engineering discipline (CI, security, config) is production-grade and rare.
6. The blog is publishable quality — and top blogs earn SigNoz interviews.

### Why it could lose
1. **F1** — a judge finds `compose("stop", "postgres")` and reads the whole
   submission as staged.
2. **B2/B3** — a dead link or "CI: failed" on camera destroys the "every ID
   resolves" thesis in one frame.
3. **B8** — the AI link, the differentiator, is demonstrated zero times.
4. **B5/B11** — an observability judge opens alerts and dashboards and finds
   inert rules and empty panels.
5. **No video, no blog** — incomplete submissions get screened out regardless of
   quality.
6. A simpler, flashier "SRE copilot with MCP" competitor demos in 90 seconds and
   *feels* more agent-native to a panel judging an event called *Agents of SigNoz*.

### Estimated probabilities

> Labelled estimate, from the six-judge model above. No outcome is guaranteed.

| Stage | As of now | After §8 Critical + High |
|---|---|---|
| Passes initial screening | **90–95%** | 96–99% |
| Reaches finalist / shortlist | **35–45%** | **60–70%** |
| Places in a prize category (Track 3) | **15–25%** | **35–50%** |
| "Overall hackathon win" *(no such official category; hypothetical best-of-panel)* | **5–10%** | **15–25%** |

The single largest movement comes from fixing F1/B1 — the latency policy — because
it converts the headline claim from *disclosed-as-uncertain* to *measured and
attributable*, and it removes the induced outage from the critical path.

---

## 8. Prioritized improvement plan

Ordered by judge-score impact per hour. Deadline is ~26 July; assume **one
working day**. Every item lists: change · why judges care · score impact ·
difficulty · risk · dependencies · how to demo · classification.

### CRITICAL — blockers. Do not submit without these. (~6 h total)

---

**C1 · Make the genuine latency regression fire the verdict**

- **Exact change.** In `apps/api/src/modules/regressions/evaluator.ts:21-29`,
  introduce `policyVersion: "v2"` with `latencyAdditiveMs: 3` (or, better, replace
  the absolute floor with a relative one: `observedP95 > baselineP95 *
  latencyMultiplier && observedP95 - baselineP95 > latencyAdditiveMs`, with
  `latencyAdditiveMs: 3`). Keep v1 in the codebase and say on the receipt that
  v1's 250 ms floor exists for request-scale services — this turns a fix into a
  design argument. Then re-run `node scripts/demo-chain.mjs <b> <c> <r>` **with
  the `duringWindow` Postgres stop removed** (C2).
- **Why judges care.** It removes F1 entirely. The verdict then fires on
  `p95 1.44 ms → 8.17 ms (+467%)`, caused by the commit, attributable to the
  commit, provable from SigNoz.
- **Score impact.** +3 to +4 overall. Largest single item in this document.
- **Difficulty.** Low (one constant + one policy row). **Risk.** Low — 40 evaluator
  tests cover this; update the two threshold fixtures.
- **Dependencies.** C2. Requires a fresh ~10-minute chain run.
- **How to demo.** Verdict banner: "Regressed — p95 1.4 ms → 8.2 ms, +467%",
  reason line "Observed p95 exceeded both 1.5× and baseline + 3 ms".
- **Essential.**

---

**C2 · Remove the induced PostgreSQL outage from the recorded chain**

- **Exact change.** Delete the `duringWindow` block at
  `scripts/demo-chain.mjs:302-310` from the *headline* chain, and drop
  `expect: "mixed"`. Keep the outage as an **explicitly separate, explicitly
  labelled** scenario — e.g. `npm run demo:dependency-failure` — and present it as
  what it honestly is: *"here is what GreenLight does when an unrelated dependency
  fails inside a measured window — it reports `regressed` and refuses to attribute
  cause."* That is a genuinely good second scene.
- **Why judges care.** The headline regression becomes real. And the induced
  outage, correctly labelled, becomes evidence of rigour rather than of staging.
- **Score impact.** +2 to +3, and removes the largest single rejection risk.
- **Difficulty.** Low. **Risk.** Low.
- **Dependencies.** None. Do this before C1's re-run.
- **How to demo.** Scene 1: real latency regression. Optional scene 2: dependency
  failure, verdict `regressed`, caveat read aloud.
- **Essential.**

---

**C3 · Make every SigNoz evidence link open in the judge's browser**

- **Exact change.** Add `SIGNOZ_PUBLIC_URL` to `apps/api/src/config.ts` (default:
  `SIGNOZ_URL`), set it to `http://127.0.0.1:8080` in `deploy/compose.local.yaml`
  for both api and worker, and use it in `SignozClient.buildTraceUrl`
  (`client.ts:303`), `buildDashboardUrl` (`client.ts:282`), and
  `buildSignozTraceUrl` (`ci-telemetry/link.ts:26`). Keep `SIGNOZ_URL` for
  server-to-server calls. Add one test asserting a link never contains
  `host.docker.internal`.
- **Why judges care.** "Every link is an ID that must resolve in a live SigNoz" is
  the thesis sentence. Four links currently 404 in a browser.
- **Score impact.** +2 (UX and Best-Use-of-SigNoz both).
- **Difficulty.** Low. **Risk.** Low.
- **Dependencies.** Re-run the chain, or `UPDATE evidence_links SET url = replace(url, 'host.docker.internal', '127.0.0.1')`.
- **How to demo.** Click "Slow trace 1" on camera → SigNoz trace detail opens with
  the span. **This should be the demo's peak moment.**
- **Essential.**

---

**C4 · Stop the timeline saying "CI: failed" when CI passed**

- **Exact change.** `apps/web/src/features/receipts/EvidenceTimeline.tsx:16` →
  render `receipt.pipeline?.conclusion ?? "missing"`. Move export state to its own
  node or a subtitle (`"telemetry: pending"`). Update `receipt.test.tsx`.
- **Why judges care.** It contradicts the pitch on screen, in the receipt's
  centrepiece, on all three changes.
- **Score impact.** +1.5. **Difficulty.** Trivial (~15 min). **Risk.** None.
- **Dependencies.** None.
- **How to demo.** Timeline reads `Claude · Commit · CI: success · Deploy: verified
  · Impact: regressed · Recovery: recovered`.
- **Essential.**

---

**C5 · Record the video and publish the blog**

- **Exact change.** Follow `docs/VIDEO_SCRIPT.md` — after C1–C4, so the screens
  match the narration. Publish `docs/BLOG.md` to Dev.to (fastest, best SigNoz-
  community reach). Fix B10 first.
- **Why judges care.** They are submission deliverables. Missing them is a
  screening failure, not a scoring one.
- **Score impact.** From "incomplete submission" to scoreable. Unbounded.
- **Difficulty.** Medium (2–3 h with retakes). **Risk.** Time.
- **Dependencies.** C1–C4, C6.
- **How to demo.** It *is* the demo.
- **Essential.**

---

**C6 · Fix the impossible p50 in the blog**

- **Exact change.** `docs/BLOG.md:39` → *"Measured against the previous release,
  p95 on `/balances` went from 1.44 ms to 8.17 ms — a 5.7× regression."* Fix the
  README opener ("Median latency… more than doubled" → "p95 … rose 5.7×") and the
  video script line to match. Then grep the whole repo for any number not
  reproducible from a receipt.
- **Why judges care.** p50 = 3.6 ms is impossible when p90 = 1.185 ms. On a project
  selling numerical honesty, this is the worst possible error to leave in the
  submitted artifact.
- **Score impact.** +1, and removes a credibility landmine.
- **Difficulty.** Trivial. **Risk.** None.
- **Essential.**

---

**C7 · Delete or clearly supersede `audit/HACKATHON_AUDIT.md`**

- **Exact change.** `git rm audit/HACKATHON_AUDIT.md` (it is stale and says
  "not submission-ready · 64/100"). If you want to keep an audit trail, replace it
  with this file and a one-line header stating it is a self-audit of a superseded
  state. Also consider moving `GREENLIGHT_IMPLEMENTATION_PLAN.md` (87 KB),
  `remediation-list.md` (34 KB), and `TASKS.yaml` out of the repo root into
  `planning/` — root clutter reads as unfinished.
- **Why judges care.** A public file telling them the project isn't ready.
- **Score impact.** +0.5, removes a pure own-goal. **Difficulty.** Trivial.
- **Essential.**

---

### HIGHEST-IMPACT (after blockers) — ~4 h

---

**H1 · Produce one commit with a verified AI link**

- **Exact change.** `source instrumentation/claude-code/env.example` (point
  `OTEL_EXPORTER_OTLP_ENDPOINT` at `http://localhost:4318`), install the hook via
  `bash instrumentation/git-hooks/install.sh`, then make one real commit inside
  that Claude Code session — a docs commit is fine. The hook injects
  `AI-Traceparent:` from `$TRACEPARENT`; sync the run; `worker-runtime.ts:232`
  verifies the exact span against `service.name = claude-code` with a ±24 h window.
  Confirm with
  `SELECT count() FROM signoz_traces.distributed_signoz_index_v3 WHERE resource_string_service$$name='claude-code'`.
- **Why judges care.** It is the product's headline noun and the thing no
  competitor will have. Today it reads `missing` three times out of three. It also
  flips the landing page out of its permanent failure state (B7) and activates the
  featured-receipt feature.
- **Score impact.** +2 to +3. Second-largest item after C1.
- **Difficulty.** Medium. **Risk.** Medium — Claude Code's OTLP export must land in
  SigNoz; verify the span exists *before* relying on it in the video.
- **Dependencies.** SigNoz running. Time-box to 60 minutes; if the span doesn't
  land, abandon and keep the honest `missing` disclosure.
- **How to demo.** Landing page shows a complete verified chain; receipt shows
  **`AI link: verified`** and the Claude span resolving in SigNoz.
- **High-value.**

---

**H2 · Make an alert fire live, and resolve on recovery**

- **Exact change.** In `signoz/alerts/*.json`, replace `$service`/`$version`/
  `$environment`/`$route` with literals. Drop `service.version` from the filter so
  the rule follows whatever is deployed. Set the p95 target to **5 ms**
  (`5000000` ns), `evalWindow: 1m`, `frequency: 1m`. Re-import via
  `npm run signoz:import`.
- **Why judges care.** "Alerts" is named in the *Best Use of SigNoz* criterion, and
  both rules are currently inert (B5). An alert that goes red on the candidate and
  green on the revert is the most legible observability moment available.
- **Score impact.** +1.5 to +2 on the SigNoz criterion.
- **Difficulty.** Low–medium. **Risk.** Low. Rehearse once — alert state has ~1 min
  latency; leave the tab open and cut to it.
- **Dependencies.** C1 (same threshold philosophy). Verify with
  `GET /api/v1/rules` that state transitions to `firing`.
- **How to demo.** Split screen: receipt says `regressed`, SigNoz alert is red.
  After recovery, both go green.
- **High-value.**

---

**H3 · One dashboard panel that tells the whole story**

- **Exact change.** In `signoz/dashboards/deployment-impact.json`, add a panel
  **"p95 by deployed version"** that drops `service.version` from the filter and
  adds `groupBy: ["service.version"]`. Set `yAxisUnit: "ns"` on every latency panel
  so SigNoz renders ms. Change the default `version` variable from the upstream
  Blnk SHA `c8fce93…` to the candidate SHA. Set the dashboard's default time range
  to 30 minutes.
- **Why judges care.** Today the flagship dashboard opens **empty** and no panel
  can show baseline vs candidate together (B11). One chart with two labelled
  series stepping from 1.4 ms to 8.2 ms is the single most persuasive image this
  project can produce, and it doesn't exist.
- **Score impact.** +1.5.
- **Difficulty.** Low–medium. **Risk.** Low — `signoz-assets.test.mjs` already
  guards compilation; run `npm run validate:signoz-assets`.
- **How to demo.** Open the dashboard cold; two series, an obvious step, an obvious
  recovery. No variable editing on camera.
- **High-value.**

---

**H4 · Fix CI trace reconstruction — one trace per run**

- **Exact change.** In `apps/api/src/modules/github/sync.ts:230-262` /
  `modules/ci-telemetry/synthesizer.ts`, ensure each run gets its own tracer
  provider and exporter flush so spans cannot merge across runs, and that the
  resulting trace ID is written to *that* run's row. The evidence: three rows share
  `17985286c153eaa9f39a824a9fd21b5a`, and each of the three emitted traces contains
  all 255 spans spanning 08:03:28→08:58:31 while the real run was 08:11:06→08:13:14.
- **Why judges care.** It restores an edge in the architecture diagram, clears
  `export_state = failed`, and un-withholds the CI trace link on every receipt.
- **Score impact.** +1 to +1.5.
- **Difficulty.** Medium (2–3 h). **Risk.** Medium — touches the sync path.
- **Dependencies.** Re-run sync after fixing.
- **How to demo.** Click the CI trace link → SigNoz shows a 2-minute, 7-job span
  tree matching the GitHub run exactly.
- **High-value** — but **cut this first if time runs short**; C4 already removes the
  visible "CI: failed" damage.

---

### SIGNOZ-SPECIFIC (smaller, high ratio)

**S1 · Remove `lms-backend` from the demo SigNoz** — stop the `infra` compose
project or point it elsewhere before recording; it is the second-largest service
in the list judges will see (B12). Also `git rm instrumentation/lms-java-agent/env.example`.
*Trivial · no risk · +0.5 · essential before recording.*

**S2 · Make `mcp:verify` fail loudly without a key** — `scripts/verify-mcp-result.mjs`
should exit non-zero when `SIGNOZ_API_KEY` is unset, or the README should show
`set -a && . ./.env.demo && set +a && npm run mcp:verify`. A green "passed" that
verified nothing is the exact failure mode this project exists to prevent (B9).
*Trivial · no risk · +0.5 · high-value.*

**S3 · Emit `commit_sha` on more worker log lines** — exactly one log record
carries it today, so "log filter `commit_sha` → trace" is true but thin.
*Low · low risk · +0.5 · optional.*

**S4 · Add a service-map beat** — with Blnk → Postgres → Redis instrumented, the
SigNoz service map is a free, visually strong 5-second shot. Confirm it renders
before promising it. *Low · low risk · +0.5 · optional.*

### PRODUCT & UI

**P1 · Per-receipt `document.title`** — `"regressed · 2fa6e28 · GreenLight"`.
*Trivial · +0.5 · high-value (tabs, history, screen readers, and it reads well on
camera).*

**P2 · Add trace evidence to the recovery receipt** — recovery and baseline
receipts carry no SigNoz links at all, so "recovered" is asserted rather than
linked. *Low · +0.5 · high-value.*

**P3 · `aria-live="polite"` on the verdict region** + a skip link. *Trivial ·
+0.5 · optional.*

**P4 · Soften the landing empty state** — even after H1 it should read as guidance,
not alarm. *Trivial · +0.5 · optional.*

### DEMO & STORYTELLING

**D1 · Rewrite the video's 0:22–0:45 beat around the *latency* regression** — after
C1/C2 the claim is provable; say "p95 rose 5.7×, and here is the SigNoz query that
says so." *Trivial · +1 · essential.*

**D2 · Add a 15-second "what it refuses to say" beat** — read the caveat aloud over
the receipt. It is the most memorable differentiator in the submission and costs
nothing. *Trivial · +0.5 · high-value.*

**D3 · Rehearse end-to-end twice with a stopwatch** — the script is ~400 words at
150 wpm; retakes are what blow the 3-minute cap. *Low · essential.*

**D4 · Pre-open all tabs and pre-warm SigNoz** — its first dashboard load is slow;
a 6-second spinner on camera reads as a broken product. *Trivial · essential.*

### DOCUMENTATION & ONBOARDING

**O1 · Put "what you'll see in 5 minutes" at the top of the README** — three
bullets and one screenshot of the verdict banner, above the architecture diagram.
Judges skim. *Trivial · +0.5 · high-value.*

**O2 · State the manual SigNoz key gate in the first quickstart line** — it is
already disclosed honestly, but a judge who hits it unannounced mid-setup reads it
as a failure. Frame it as "SigNoz deliberately does not expose API keys to
automation; here is the one 30-second step." *Trivial · +0.5 · high-value.*

**O3 · Prune root clutter** — see C7. 46 files in `docs/` is more than any judge
will read; a short index would help. *Low · +0.5 · optional.*

### OPTIONAL DIFFERENTIATORS (only if C+H are done and time remains)

**X1 · A second, unstaged regression on a different route** — proves generality
rather than a single tuned path. *High effort · medium risk · +1 · optional.*

**X2 · Live MCP query on camera** instead of the recorded fixture — the fixture is
honest, but asking the MCP server live is far more "agent-native" for an event
called *Agents of SigNoz*. *Medium · medium risk · +1 · optional but the highest-
upside optional item.*

**X3 · A GitHub Action that posts the receipt as a PR comment** — closes the loop
into the developer's actual workflow. *High effort · +1 · optional.*

---

## 9. Recommended live-demo sequence (3:00)

Assumes C1–C7 and H1–H3 are done. Tabs pre-opened and pre-warmed.

| Time | Screen | Beat |
|---|---|---|
| 0:00–0:20 | PR #64, checks tab, **8 green** | "An AI wrote this change. Eight checks passed. It shipped." |
| 0:20–0:35 | The one-line diff | "`conn_max_lifetime: 1000000`. It's a Go duration — that's not 16 minutes, it's **one millisecond**. The service threw away every database connection the instant it opened one." |
| 0:35–1:05 | Receipt: verdict banner | "**Regressed.** p95 1.4 ms → 8.2 ms, +467%, over 250 requests in each window. Scoped to the deployed `service.version`, not wall-clock." |
| 1:05–1:25 | **Click "Slow trace 1"** → SigNoz trace detail | "Every link on this receipt is an ID that has to resolve in a live SigNoz. Here it is." ← *peak moment* |
| 1:25–1:40 | SigNoz alert, **red** | "The same threshold as a SigNoz alert rule, firing right now." |
| 1:40–2:00 | Dashboard: p95 grouped by `service.version` | "Two versions, one chart. That step is the deploy." |
| 2:00–2:15 | Receipt: AI link **verified** + Claude span | "And this commit came out of a Claude Code session whose trace is in the same SigNoz." *(only if H1 landed)* |
| 2:15–2:35 | Recovery receipt + alert going green | "The revert. **Recovered** — measured, not assumed." |
| 2:35–2:50 | Caveat line, held on screen | "And here's what it refuses to say: correlation of version and failure, not proof of causation." |
| 2:50–3:00 | Architecture diagram | "Blnk — someone else's Apache-2.0 ledger. It has never heard of GreenLight." |

**Never show on camera:** the SigNoz services list (until S1), `demo-chain.mjs`,
the landing page before H1, any receipt other than the candidate and recovery.

---

## 10. Concise submission description (paste-ready)

> **GreenLight — a flight recorder for AI-authored change.**
>
> An AI wrote a one-line config change. It passed all eight CI checks, was
> reviewed, merged, and deployed — and p95 on the affected endpoint rose 5.7×.
> No test could have caught it: `conn_max_lifetime: 1000000` is a valid integer
> in a valid field, and as a Go duration it means one millisecond, not sixteen
> minutes.
>
> GreenLight records that gap. It ties an AI coding session to the commit it
> produced, the CI run that validated it, the immutable deployed version, the
> SigNoz telemetry that followed, and the evidence that a later change recovered
> the service — and issues a **change receipt** with a verdict.
>
> SigNoz is the evidence system, not a dashboard bolted on. Traces decide the
> verdict through Query Builder v5 queries scoped to a single immutable
> `service.version`, so "before and after" is a version comparison rather than an
> ambiguous wall-clock one. Custom metrics carry what traces cannot — verdicts by
> status and route, AI verification state, queue depth, dependency health. Logs
> ship over OTLP with trace context and a `commit_sha`, because an investigator
> arrives holding a commit. Three dashboards, fourteen panels, and a true
> error-rate alert rule are imported through the API and verified by replaying the
> query the renderer actually sends. And GreenLight asks the SigNoz MCP server the
> same questions an investigating agent would, over streamable HTTP, with no
> direct-API fallback.
>
> The monitored workload is **Blnk v0.15.1**, a third-party Apache-2.0 financial
> ledger, fetched and hash-verified rather than vendored. It knows nothing about
> GreenLight, so a detected regression is not a regression written to be detected.
>
> Every link in the chain is an ID that must resolve in a live SigNoz. When one
> does not, the receipt says so rather than rendering a confident blank. And every
> receipt states what it refuses to conclude: deployment correlation is evidence of
> temporal and version association, not proof of causation.
>
> Track 3 — Build Your Own. MIT. Whole stack pinned by manifest digest and verified
> at runtime before the demo is permitted to claim anything.

---

## 11. Assets to capture

**Screenshots (in this order):**
1. PR #64 checks tab — 8 green
2. The one-line diff
3. Receipt verdict banner — "Regressed", p95 1.4→8.2 ms
4. Receipt timeline — all six nodes green *(after C4/H1)*
5. Receipt evidence section with a trace link **open in SigNoz beside it**
6. Recovery receipt — "Recovered"
7. Landing page — complete verified chain *(after H1)*
8. Mobile receipt at 390 px (already good — keep it)

**SigNoz captures:**
9. Deployment Impact — **p95 grouped by `service.version`**, two series, visible step *(H3)*
10. Self Observability — the four `greenlight.*` metrics
11. Pipeline Health — reconstructed CI runs *(after H4)*
12. Alert rule in **firing** state, then resolved *(H2)*
13. Trace detail for a slow `/balances` request
14. Logs view filtered by `commit_sha` → the linked trace
15. Service map *(only if it renders cleanly — S4)*

**Failure scenarios worth showing (this project's differentiator):**
16. Missing receipt — "No receipt exists for this commit" *(already excellent)*
17. AI link `missing` on a non-instrumented commit vs `verified` on an
    instrumented one, side by side — proves the state machine is real
18. `insufficient_data` verdict from a window with <200 spans
19. The dependency-failure scenario *(C2's relabelled second scene)* — verdict
    `regressed`, caveat prominent, explicitly not attributed to the commit
20. SigNoz unreachable → `integration_error`, never "healthy"

---

## 12. Likely judge questions, with strong answers

**Q: "Isn't the regression staged? You control both the workload and the bug."**
A: The workload is Blnk v0.15.1, Apache-2.0, at upstream commit `c8fce93`, fetched
and hash-verified at build time and never vendored — a verification step proves the
checkout's origin, tag, SHA, and that a single approved OpenTelemetry patch is its
only modification. It has no knowledge of GreenLight. The change is one line of
*its* configuration, and it's a real Go `time.Duration` JSON-decoding trap that has
bitten real services. *(Post-C2. Do not attempt this answer before C2.)*

**Q: "Why not just compare by time window?"**
A: Deploys overlap, rollbacks happen, and traffic shifts. Wall-clock windows
silently blend versions. Every query pins `service.version = <commit sha>`, so the
comparison is between two immutable artifacts. That's also why the receipt records
an image digest — you can prove what ran.

**Q: "38% error rate from a connection-pool setting seems high."** *(only if you
keep the dependency scenario)*
A: That number comes from the labelled dependency-failure scenario, not the
headline one. The headline verdict fires on latency: p95 1.44 ms → 8.17 ms,
+467%, attributable to the commit. The dependency scenario exists to show what
GreenLight does when something *unrelated* fails inside a measured window — it
reports `regressed` and explicitly refuses to attribute cause.

**Q: "Why did latency not trigger the verdict originally?"**
A: Policy v1 required both a 1.5× multiplier and a +250 ms absolute rise — a
sensible guard for request-scale services and the wrong guard for a 1.4 ms
endpoint. Policy v2 makes the floor scale-relative. Both policies are versioned
and every receipt records which one decided it, so an old verdict stays
reproducible.

**Q: "What if SigNoz is down?"**
A: `integration_error` — a distinct outcome from both `insufficient_data` and
`healthy`. Nothing may impersonate a verdict. It's counted as a metric outcome
too, so the totals never imply SigNoz always answered.

**Q: "How does this scale past one route and one service?"**
A: The query scope is already parameterised on service, version, environment, and
route; the demo pins one route for legibility. The real scaling constraint is
baseline selection — today the baseline is the previously-frozen good deployment.
At ten deploys an hour you'd want a rolling baseline over the last N healthy
versions, which is a policy change, not an architecture change.

**Q: "Isn't 'we can't prove causation' a cop-out?"**
A: It's the product. A tool that overstates once is a tool you check manually
forever after. GreenLight states version-and-time association, shows the evidence,
and hands you a `git revert`. The judgement stays with the engineer.

**Q: "What's genuinely hard here?"**
A: Three things. Making before/after mean something when deploys overlap — solved
by version scoping. Reconstructing CI as spans from the REST API without native
runner telemetry, backdated correctly. And building a verification layer that
distinguishes "the evidence is absent" from "the evidence is malformed" from "the
backend was unreachable" — that distinction is where most of the tests are, and
getting it wrong was the worst bug I shipped and fixed.

---

## 13. Final checklists

**Repository**
- [ ] C7: `audit/HACKATHON_AUDIT.md` removed or superseded
- [ ] S1: `instrumentation/lms-java-agent/env.example` removed
- [ ] O3: planning docs moved out of root
- [ ] README opens with "what you'll see in 5 minutes" + verdict screenshot (O1)
- [ ] `npm run verify` green on a clean clone
- [ ] `casting.yaml` + `casting.yaml.lock` at root ✅ *(already true)*
- [ ] Public, MIT, no secrets tracked ✅ *(verified)*
- [ ] No number in any doc that can't be reproduced from a receipt (C6)

**Submission form**
- [ ] Track 3 — Build Your Own
- [ ] Public repo URL
- [ ] Blog URL (Dev.to) — **published** (C5)
- [ ] YouTube URL, ≤3:00 — **recorded** (C5)
- [ ] Description from §10
- [ ] "How SigNoz is used" from `docs/SUBMISSION.md`
- [ ] Deadline and timezone **confirmed against the form itself**
- [ ] Prior-work rule confirmed in SigNoz Slack

**Video**
- [ ] Under 3:00 with headroom
- [ ] Screens match narration in all four previously-contradicting places
- [ ] A trace link clicked and opening on camera (C3)
- [ ] An alert visibly firing (H2)
- [ ] Caveat read aloud (D2)
- [ ] Browser at ~125%; no visible spinners; no `lms-backend` on screen

**Live presentation**
- [ ] `npm run demo:status` — 5/5 green immediately beforehand
- [ ] All tabs pre-opened and pre-warmed (D4)
- [ ] `bash scripts/signoz-runtime-verify.sh` run once, on camera if there's time
- [ ] Answers from §12 rehearsed, especially the "isn't it staged?" one

---

## 14. The ten actions that most change the outcome

Ordered by expected score movement per hour.

1. **Make the latency policy scale-aware so the real regression fires the verdict** (C1) — converts the headline claim from disclosed-as-uncertain to measured and attributable. *Biggest single move: +3 to +4.*
2. **Remove the induced PostgreSQL outage from the headline chain; keep it as a labelled second scenario** (C2) — eliminates the largest rejection risk and converts it into evidence of rigour.
3. **Record the video and publish the blog** (C5) — without these there is no complete submission to score.
4. **Fix the evidence-link origin so trace links open in a browser** (C3) — the thesis sentence is currently false in the most visible place; clicking one on camera becomes the demo's peak.
5. **Produce one commit with a verified AI link** (H1) — the differentiator, currently demonstrated zero times; also flips the landing page out of its permanent failure state.
6. **Fix the timeline's "CI: failed"** (C4) — 15 minutes, removes an on-screen contradiction of the pitch's premise.
7. **Make an alert fire live and resolve on recovery** (H2) — "alerts" is named in the SigNoz criterion and both rules are currently inert.
8. **Add a p95-grouped-by-`service.version` panel, fix units and the default variable** (H3) — the flagship dashboard currently opens empty; this produces the single most persuasive image available.
9. **Fix the impossible p50 in the blog and delete the stale self-audit** (C6 + C7) — two trivial edits removing two credibility landmines from public artifacts.
10. **Remove `lms-backend` from the demo SigNoz before recording** (S1) — 15 minutes; stops a foreign service appearing on a screen judges will look at.

**Projected after all ten: 84/100**, finalist probability **60–70%**, Track 3
placement **35–50%**.

The idea, the third-party workload, and the engineering discipline are already
prize-grade. Every item above is about stopping the artifact from contradicting
its own story — which is, fittingly, the exact failure mode this project was
built to detect.
