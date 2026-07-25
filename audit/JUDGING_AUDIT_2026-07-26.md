# GreenLight — Hackathon Judging Audit (run-verified)

**Audit date:** 26 July 2026, 01:45–02:15 IST
**Time to deadline at time of writing:** ~3 h 15 m (deadline asserted as 26 Jul 05:29 IST)
**Stance:** six-judge adversarial panel, evidence only
**Method:** the running stack was exercised. Every finding cites a command, an
HTTP response, a ClickHouse row, a rendered screenshot, or a file and line.

This supersedes `audit/JUDGING_AUDIT_2026-07-25.md`. That audit was accurate when
written; **most of its blockers have since been fixed** (see §3.3). Two have not,
and this audit adds four defects that did not exist or were not visible yesterday.

---

## 0a. Status update — remediation applied 02:15–02:45 IST

Everything in §3.2 marked below as fixed was implemented, verified against the
running stack, and the demo assets regenerated, **after** the audit body was
written. The audit body is left as written so the reasoning stays auditable.

| ID | Defect | State |
|---|---|---|
| D1 | Landing page hid the flagship receipt | ✅ **Fixed** — features `2fa6e28`, renders a 4-link checklist, receipt one click away |
| D3 | MCP transcript disjoint from the recorded run | ✅ **Fixed** — re-captured over a 15 h window containing both versions; `docs/MCP_DEMO.md` and `docs/BLOG.md` corrected |
| D4 | Baseline/observed windows 10.5 h apart, unexplained | ✅ **Fixed** — receipt states the frozen baseline; `README.md` reconciled |
| D5 | Identical image digest across all three deployments | ✅ **Fixed** — receipt names it a configuration-only change |
| D6 | README claimed an AI wrote the change | ✅ **Fixed** — README, blog and video script all reworded |
| D7 | `AI: Missing` red on every row | ✅ **Fixed** — now amber `AI: Not linked`; `failed`/`invalid` stay red |
| D10 | `.codex/` broke local `npm run lint`; stale "14 panels" | ✅ **Fixed** — ignored in eslint + gitignore; count corrected to 16 |
| D2 | **Blog unpublished, video unrecorded** | ❌ **STILL OPEN — the only remaining blocker** |
| D8 | Accessibility gate | ⚠️ Deliberately deferred — poor score-per-minute before the deadline |
| D9 | E2E is one assertion | ⚠️ Deferred; the landing fix is covered by two new unit tests instead |

An additional defect was found and fixed during remediation: preferring the
`recovered` verdict sent the featured link to the **revert** commit, whose
receipt carries `impact: null`, `recovery: null` and only two evidence links.
The ranking now prefers the regressed commit, whose receipt carries the whole
arc. This is pinned by a test.

**Verification after remediation** — all re-run against the live stack:

| Gate | Result |
|---|---|
| `npm run verify` | **exit 0** — 223 passed, 13 skipped (was 220) |
| `npm run quality` | policy checks passed across 279 tracked files |
| `npm run lint` | clean |
| `npm run demo:status` | all five health checks healthy |
| `npm run verify:receipt-links` | 24/24 resolve |
| `npm run mcp:verify` | 3/3 traces resolve |
| `npm run validate:signoz-assets` | 3 dashboards, 2 alert rules |
| `scripts/signoz-runtime-verify.sh` | all pinned runtime checks passed |
| `npm run test:e2e:smoke` | 1 passed |
| Demo screenshots | regenerated against the deployed build |

The web image was rebuilt and redeployed, so the running stack at
`http://127.0.0.1:4173` serves these changes now.

---

## 0. Bottom line, before anything else

**Submission-ready?** The *software* is. The *submission* is not — the blog and
the video are unpublished, and they are form requirements. That is the only thing
standing between this project and a credible entry.

**Finalist-quality?** Yes, on engineering. The code is in the top decile of what
this hackathon will receive. It is being held back by a landing page that tells
judges the demo does not work.

**The three things that matter in the next three hours:**

1. **Fix the landing page** (`featured.ts`, ~15 lines). Right now `/` says
   *"4 change(s) recorded, but none has a complete chain yet"* and offers **no
   link to the flagship receipt**. This was identified in yesterday's audit as
   B7 and is still shipped. It is the first thing every judge sees. **~25 min.**
2. **Publish the blog and record the video.** Without them the submission may not
   clear screening at all. **~90 min.**
3. **Re-capture the MCP fixture** (`npm run mcp:capture`). The committed
   transcript was captured 8.8 hours *before* the recorded chain's measurement
   window opened and reports a 32.89 % error rate the receipt says was 0.00 %.
   **~10 min**, and it removes the only finding that could be characterised as
   the project contradicting its own thesis.

Everything else in this document is optimisation.

---

## 1. Hackathon facts

Source: <https://www.wemakedevs.org/hackathons/signoz> and
<https://www.wemakedevs.org/hackathons/signoz/rules> (fetched during this audit).

### 1.1 Confirmed (quoted or directly paraphrased from official pages)

| Fact | Value |
|---|---|
| Event | **Agents of SigNoz**, WeMakeDevs × SigNoz |
| Dates | 20 – 26 July 2026 |
| Prize pool | $20,000 |
| Tracks | 01 AI & Agent Observability · 02 Signals & Dashboards · 03 Build Your Own |
| Track 03 prize | iPhone Air per team member, or cash equivalent |
| Team size | 1–4 |
| Hard requirement | "Your project must use or integrate with SigNoz for observability." |
| SigNoz install | "Install SigNoz using Foundry" — sets up SigNoz **and** its MCP server |
| Repo requirement | **`casting.yaml` and `casting.yaml.lock` must be in the repository** |
| Recommended | "Using the MCP server, Query Builder, dashboards, and alerts is recommended" |
| AI disclosure | "permitted but **must be declared** in your submission. Failure to disclose will result in disqualification." |
| Prior work | "coding and design work should begin only after the hackathon starts"; notes/sketches/diagrams allowed beforehand |
| IP | retained by the team |
| Submission | via official form, before the deadline |

**Official judging criteria, verbatim:**

1. **Potential Impact** — "How effectively does the project address a meaningful problem or unlock a valuable use case with observability?"
2. **Creativity & Innovation** — "How unique is the idea? Does it push the boundaries of what's possible when you can see inside your systems?"
3. **Technical Excellence** — "How well is the project implemented? Does it demonstrate strong engineering practices and clean, maintainable code?"
4. **Best Use of SigNoz** — "How deeply and effectively does the project lean on SigNoz, traces, metrics, logs, dashboards, and alerts?"
5. **User Experience** — "Is the project intuitive to use? Does it provide a polished experience that users would actually want to adopt?"
6. **Presentation Quality** — "How clearly is the project presented? Do the demo, README, and submission communicate the problem, solution, and impact?"

### 1.2 Not published — treated as assumption and labelled as such

- **No criterion weights.** This audit uses **equal weight (1/6 each)** and the
  scorecard is therefore an **estimate**, not an official calculation.
- **No overall-winner prize is described.** The three tracks read as independent
  prizes. Any "win the hackathon" figure below is a hypothetical best-of-panel
  number, not a real category.
- **FAQ answers do not render** on the page — only the question headings. So
  eligibility detail and the prior-work rule could not be read verbatim. The
  rules page does state the "coding starts after launch" rule, which is what
  matters here.
- **Exact deadline time and timezone are not published.** `docs/SUBMISSION.md`
  asserts 26 Jul 05:29 IST. **Verify this on the form itself before relying on
  it.** Everything in §7 is scheduled against that figure.
- **Video length.** `docs/VIDEO_SCRIPT.md` says the form caps it at 3 minutes.
  Not independently confirmable from the public pages; trust the form.

### 1.3 Compliance check

| Rule | State | Evidence |
|---|---|---|
| Uses/integrates SigNoz | ✅ Central | traces drive the verdict; §3.1 |
| Installed via Foundry | ✅ | `foundryctl v0.2.16` verified by `scripts/signoz-runtime-verify.sh` |
| `casting.yaml` + `.lock` at root | ✅ | both present, all six images digest-pinned |
| MCP server used | ✅ | `signoz-mcp` v0.9.0 running; transcript over streamable HTTP |
| Coding began after 20 Jul | ✅ | first commit `1945c63`, **23 Jul 2026 20:08 IST** |
| AI assistance declared | ✅ | `README.md` §"AI assistance disclosure" + `PROVENANCE.md` |
| Public repo | ✅ | `sid12701/greenlight-ai-change-flight-recorder`, PUBLIC, MIT |
| Team ≤ 4 | ✅ | solo |
| Blog published | ❌ **BLOCKER** | `docs/BLOG.md` written, not published |
| Video recorded | ❌ **BLOCKER** | script written, **no video file exists anywhere in the repo** |

One flag worth two minutes of thought: commits are authored under
`sid12701 <78287897+sid12701@users.noreply.github.com>`, but the most recent
commit's author name resolves to **"Kanchan Daryanani"** while the registered
participant is presumably Siddhant Daryanani. If the form's name and the commit
identity disagree, a screener may query it. Make sure the submission form names
whoever owns the GitHub account.

---

## 2. What was actually run during this audit

| Action | Result |
|---|---|
| `npm run verify` (clean → lint → typecheck → test → build) | **exit 0** |
| Test totals | **220 passed, 13 skipped, 0 failed** across 4 suites (24 + 136 + 42 + 31) |
| Web production build | 313.93 kB JS / 91.21 kB gzip, built in 1.11 s |
| `docker ps` | 14 project containers healthy; SigNoz stack up 12–23 h |
| `GET /readyz` | `200 {"status":"ready","checks":{"database":"ok"}}` |
| `GET /api/v1/status/dependencies` | `{"database":"ok","github":"ok","signoz":"ok"}` |
| `GET /api/v1/changes` | 4 real changes, real SHAs, real verdicts |
| `GET /api/v1/changes/2fa6e28…` | full receipt, `regressed`, p95 1.4394 → 10.4499 ms |
| `npm run verify:receipt-links` | **24/24 published links resolve across 4 receipts** |
| `npm run mcp:verify` (authed) | 3 traces resolve, 2 spans each |
| `npm run mcp:verify` (unauthed) | **fails loudly with a remedy** — does not silently pass |
| `npm run ai-link:verify` | correctly reports 2 of 4 links unarmed, per-link remedies |
| `bash scripts/signoz-runtime-verify.sh` | **all 6 image digests match**, SigNoz v0.134.0, MCP v0.9.0, OTLP accepted |
| SigNoz dashboards API | 3 dashboards, **16 panels** (7 + 5 + 4) |
| SigNoz rules API | 2 rules, both enabled, both `inactive` (no load at audit time) |
| ClickHouse span census (12 h) | only project services: `blnk-loan-workload` 14 644, `greenlight-api` 4 036, `greenlight-ci` 510, `greenlight-worker` 40, `greenlight-smoke` 2 |
| Secret scan of tracked files | **clean** — no `.env` tracked, no hardcoded credentials |
| Code smell scan | **zero** TODO/FIXME/HACK/XXX, **zero** `as any`, **zero** `@ts-ignore` in `apps/` + `packages/` |
| GitHub Actions | latest `main` run **success**, 2 m 27 s; 6 jobs + required gate |
| Repo metadata | PUBLIC, MIT licensed, described |

Two things I did **not** re-verify and am not scoring as proven-by-me:

- **Alert firing.** Both rules exist, are valid Query Builder v5, and are
  enabled. I observed them `inactive` under no load. The `firing` → `inactive`
  transition is recorded in `docs/` from an earlier run; I did not reproduce it.
- **Browser accessibility.** The Chrome DevTools MCP session was already bound to
  another profile and I could not drive a live browser. I assessed the UI from
  the five committed screenshots (regenerated 01:09 today) and from source.

---

## 3. Findings

### 3.1 What is genuinely strong (protect this)

This is not filler. These are the reasons the project can win.

- **The thesis is correct and current.** "AI wrote it, CI passed it, production
  degraded, nobody can connect those three facts" is a real, sharply-framed
  problem, and it is the problem SigNoz's own issue #11657 describes.
- **SigNoz is load-bearing, not decorative.** The verdict is *computed from*
  Query Builder v5 trace aggregations. Delete SigNoz and the product returns no
  answer at all. That is the strongest possible answer to "Best Use of SigNoz."
- **The version-scoped comparison is the right primitive.** Filtering on
  `service.version = <commit sha>` rather than a wall-clock window is a genuinely
  better idea than most submissions will have, and it is implemented, not
  described.
- **Third-party workload.** Blnk v0.15.1 at a pinned commit, fetched and
  verified, not vendored. The workload cannot be accused of being written to be
  detected. Very few submissions will do this.
- **Refusal semantics.** `missing`, `insufficient_data`, `integration_error` are
  first-class states. The product declines to render a confident blank. This is
  the most distinctive design choice in the project and it is real.
- **Engineering quality is exceptional for a 3-day hackathon build.** 220 tests;
  6-job CI with a required gate; digest-pinned everything; distroless non-root
  UID 65532; read-only filesystems; production-only CycloneDX SBOM; Trivy image
  scans pinned to a commit; zero high/critical findings; zero TODOs; zero
  `as any`. I looked for hacks and found none.
- **The verification harness fails honestly.** `mcp:verify` without a key
  *refuses to pass*. `ai-link:verify` names which of four links is unarmed.
  This is the behaviour the whole product argues for, applied to itself.

### 3.2 Open defects, ranked by judge impact

---

#### **D1 — The landing page tells every judge the demo is incomplete** 🔴 CRITICAL

**Status:** identified as B7 in yesterday's audit, **still shipped**.

`/` currently renders (verified in `audit/screenshots/01-landing.png`, captured
01:09 today):

> **4 change(s) recorded, but none has a complete chain yet.**
> A chain is complete when the AI session, CI run, deployment, and regression
> verdict all resolve. Produce one with:
> `node scripts/demo-chain.mjs <baseline-sha> <candidate-sha> <recovery-sha>`

There is **no link to the receipt**. The flagship artifact — the `regressed`
verdict with the 7.3× rise — is unreachable from the front door.

**Root cause:** `apps/web/src/features/landing/featured.ts:19`

```ts
const links = [
  change.aiVerificationState === "verified",   // ← always false, by design
  change.primaryWorkflowConclusion !== null,
  change.deploymentStatus !== null,
  hasVerdict,
];
```

`aiVerificationState` is `missing` on all four changes — a *documented,
deliberate* limitation. So `selectFeaturedChange()` can never return a change,
the `featured` branch of `DemoReceipt` is dead code, and the landing page is
permanently pinned to its failure state.

**Why judges care:** it is the first screen. A judge with six submissions to get
through reads "none has a complete chain yet", concludes the project does not
work, and never reaches the receipt. This single defect is doing more damage than
every other item in this document combined.

**Compounding it:** the `<h1>` promises *"Every change is traced from the AI
session that wrote it"* — directly above a panel saying no chain resolves. The
page contradicts itself in two adjacent elements.

**Fix (~25 min, low risk):** grade the chain instead of gating it. Feature the
strongest change available, show the four links as a per-link checklist with
three green and one honestly `missing`, and keep the "Open the receipt" button
always live when a verdict exists. Do **not** fake the AI link — the honesty is
an asset; hiding the hero is not honesty, it is self-sabotage.

**Score impact:** User Experience **+2.0**, Presentation **+0.5**.

---

#### **D2 — Blog unpublished, video unrecorded** 🔴 CRITICAL

`docs/BLOG.md` (310 lines) and `docs/VIDEO_SCRIPT.md` (125 lines) are written and
good. Neither is published. `find` across the repo returns **no video file of any
format**.

**Why judges care:** these are submission-form fields. Presentation Quality is
1/6 of the official score and is currently being scored against a text file
nobody outside the repo can see. A missing video is also a plausible screening
failure, not just a scoring penalty.

**Fix:** publish `docs/BLOG.md` to Dev.to (fastest — paste, tag, publish, ~15
min). Record the video against the existing script (~60–75 min including one
retake). **This is the single largest block of remaining work and it should start
before any code change.**

**Score impact:** Presentation Quality **4.5 → 8.0**.

---

#### **D3 — The committed MCP transcript does not cover the recorded run** 🟠 HIGH · NEW

`test/fixtures/signoz/mcp-investigation.json`:

```json
"capturedAt": "2026-07-25T10:32:48.902Z",
"window": { "start": "2026-07-25T07:32:48.107Z", "end": "2026-07-25T10:32:48.107Z" },
"candidateP95Ms": 8.3068806,
"candidateErrorRate": 32.89036544850498
```

The recorded chain's candidate window is **19:20:25 → 19:21:55 UTC**. The MCP
capture window **ends 8 h 48 m before that window opens**. They do not overlap at
all. The 32.89 % error rate is residue from the *superseded* fault-injection demo
— the one the team correctly split out into its own scenario.

`docs/MCP_DEMO.md` claims:

> These figures are gathered independently of the receipt's own evaluation, over
> a wider window, so they corroborate the verdict rather than restate it.

That is **not true as written**. It is not a wider window containing the
receipt's; it is a disjoint earlier window. And `npm run mcp:verify` passes
anyway, because it only checks that the cited trace IDs resolve — it never checks
the window relates to the receipt.

**Why judges care:** this is the one finding that lets a hostile reviewer say the
project violates its own thesis. A judge comparing the MCP table (32.89 % errors)
against the receipt (0.00 % → 0.00 %) sees two different numbers for the same
commit with no reconciliation. In a project whose entire pitch is "every claim
resolves to evidence," that is the most expensive possible bug.

**Fix (~10 min, low risk):**

```bash
set -a; . ./.env.demo; set +a
export SIGNOZ_MCP_URL=http://127.0.0.1:8000/mcp
export BASELINE_SHA=6f458c91ccfd2dd0ba1e4f1445a19db66ccf52ee
export CANDIDATE_SHA=2fa6e2861eabf162a26af0d0ef012124865811df
npm run mcp:capture && npm run mcp:verify
```

The capture uses a rolling 3-hour window. Run now (~20:45 UTC) it spans
~17:45 → 20:45 UTC, which **does** contain the candidate window — so the numbers
will legitimately corroborate the receipt, and the error rate will come back
0 %. Then update the table in `docs/MCP_DEMO.md`.

**Bonus hardening if there's time (~15 min):** make `verify-mcp-result.mjs`
assert the fixture window contains the receipt's observed window. That converts
this class of defect from "possible again" to "impossible", and it is exactly the
kind of self-applied rigour that wins the SigNoz judge.

**Score impact:** Best Use of SigNoz **+0.5**, and removes a tail risk of a much
larger penalty.

---

#### **D4 — Baseline and candidate windows are 10.5 hours apart, side by side** 🟠 HIGH · NEW

The receipt renders (see `audit/screenshots/03-receipt.png`):

| | |
|---|---|
| Baseline window | Jul 25, 2:16:19 PM – 2:17:49 PM |
| Observed window | Jul 26, 12:50:25 AM – 12:51:55 AM |

Ten and a half hours, printed adjacent. Meanwhile `README.md:105` says *"A run
takes about ten minutes."*

This is **by design** — `docs/DEMO_STATE.md` lists the `role=baseline`
deployment as immutable and never cleared by soft reset, so the frozen baseline
is reused across rehearsals. But nothing on the receipt says so, and the README
implies one contiguous run.

**Why judges care:** an observability judge's reflex is "what else changed in
those ten hours?" The answer is good — it's a version-scoped comparison, not a
wall-clock one, which is the whole point of the design — but the receipt makes
them ask before it answers.

**Fix (~10 min, docs-only, zero risk):** add one line under the window pair, e.g.
*"Baseline is the frozen last-known-good deployment (`6f458c9`), reused across
rehearsals — comparison is by immutable `service.version`, not by wall clock."*
Reconcile `README.md:105` to say the same. Turns a suspicion into a design point.

**Score impact:** Technical Excellence **+0.3**, and it converts a likely hostile
judge question into a scripted strong answer (see §11 Q3).

---

#### **D5 — All three deployments report the same image digest** 🟠 HIGH · NEW

| Role | Version | Image digest |
|---|---|---|
| baseline `6f458c9` | 6f458c91…52ee | `sha256:9cbc03df0889…c92c9` |
| candidate `2fa6e28` | 2fa6e286…11df | `sha256:9cbc03df0889…c92c9` |
| recovery `c65cd73` | c65cd730…1dcd | `sha256:9cbc03df0889…c92c9` |

Identical. And the receipt shows the recovery digest and the candidate digest
**on the same screen**, so this is judge-visible without any digging.

The explanation is legitimate: the change is to `integrations/blnk/release.json`
(a mounted config file — `conn_max_lifetime: 1000000`), so the *image* genuinely
does not change; only the configuration does. But the receipt presents
`imageDigest` as the deployment's identity, and here it discriminates nothing.
The README's framing — "the immutable deployed version" — is carried by
`service.version`, not by the digest.

**Why judges care:** "your regressed build and your fixed build are the same
image — so what actually shipped?" is a devastating question if it lands
unprepared, and a *great* moment if it lands prepared: the honest answer is
*"the artifact is identical; the config differs — which is exactly the class of
change that slips through CI, and exactly why version-scoped telemetry beats
image-scoped."*

**Fix (~10 min, docs + one label):** label the field
`Image digest (unchanged — this is a configuration change)` and add the config
delta to the receipt or the demo notes. Cheapest possible conversion of a
weakness into a talking point.

**Score impact:** Technical Excellence **+0.2**, large reduction in demo risk.

---

#### **D6 — The README's first sentence claims something the product reports as `missing`** 🟡 MEDIUM · NEW

`README.md:3` opens:

> **An AI wrote a one-line config change.** It passed all eight CI checks, was
> reviewed, merged, and deployed. p95 latency on the affected endpoint then rose
> 7.3x.

`README.md:149` discloses:

> AI verification reads `missing` for the recorded commits… The recorded commits
> were **not authored in such a session**.

The 7.3× figure ties the opening sentence to *this specific run*, so it reads as
a claim about `2fa6e28` — and the project's own evidence says no AI session is
linked to `2fa6e28`. The same contradiction appears in the web `<h1>`
("Every change is traced from the AI session that wrote it") and in the GitHub
repo description.

**Why judges care:** a judge who reads to the bottom of the README finds the
project's headline claim retracted by its own limitations section. For a project
selling evidential integrity, that asymmetry is the worst place to have it.

**Fix (~5 min):** make the opener archetypal rather than autobiographical —
*"An AI writes a one-line config change. It passes all eight CI checks…"* — or
attribute it plainly: *"A one-line config change — the kind coding agents produce
dozens of a day — passed all eight CI checks…"* Keep the 7.3×; it's real.

**Score impact:** Presentation **+0.3**, Potential Impact **+0.2**, removes an
own-goal.

---

#### **D7 — "AI: Missing" is red on every row of the change list** 🟡 MEDIUM

`audit/screenshots/02-change-list.png`: all four rows carry a red
`AI: Missing` badge. Red is the same tone used for `Verdict: Regressed`. The most
alarming colour in the product is attached to a feature that is *never* satisfied
in the demo, so the list reads as "the AI feature is broken" four times over.

**Fix (~10 min):** give `missing` a neutral/amber tone distinct from failure red
in `apps/web/src/status.ts`, and change the label to `AI: not linked` with the
existing tooltip. It is not an error — it is an unarmed optional link.

**Score impact:** User Experience **+0.3**.

---

#### **D8 — Accessibility gates were planned and never landed** 🟡 MEDIUM

`docs/HACKATHON_EXECUTION.md` H-20 (axe, keyboard, focus, mobile checks blocking
CI) is `planned`. The UI does do several things right — badge meanings are in
text not colour alone, `aria-labelledby` on sections, `role="alert"` /
`role="status"`, `<time datetime>` — but there is no automated check, and I could
not drive a browser to verify contrast or focus order.

**Why judges care:** User Experience is an official criterion. It is unlikely a
judge runs axe, but "polished experience users would adopt" is the bar.

**Fix:** **do not attempt before the deadline.** Too little score for the time.
Note it honestly as future work.

---

#### **D9 — E2E coverage is one assertion** 🟢 LOW

`e2e/smoke.spec.ts` contains a single test asserting the `Changes` heading
renders. The `browser` CI job therefore proves the app boots and nothing more.
Real coverage lives in the 220 unit/integration tests, which is fine — but if a
judge greps for E2E they will find a stub.

**Fix:** not before the deadline. If the landing fix (D1) is made, add one
assertion that `/` renders a receipt link — it protects the highest-value fix at
near-zero cost (~10 min).

---

#### **D10 — Small hygiene items** 🟢 LOW

- `GET /healthz` returns **404** on the API (only `/readyz` exists). Nothing in
  the README references it, so this is cosmetic — but a judge poking at
  conventional endpoints gets a 404 from a health-obsessed project.
- `greenlight-smoke` (2 spans, from my `signoz-runtime-verify.sh` run) now
  appears in the SigNoz service list and will be on camera during the dashboard
  tour. Harmless, slightly untidy.
- `relatedPipelineCount` is `0` on all four changes and `relatedPipelines` is
  `[]`; whatever UI affordance exists for it is permanently empty.
- Three unrelated `lms-*` containers (postgres, rabbitmq, redis) are running from
  a different project. They emit **no spans** (ClickHouse census confirms only
  project services), so SigNoz is clean — but `docker ps` on camera would look
  sloppy. Stop them before recording.
- Node mismatch: `engines` requires `>=24 <25`, `.nvmrc` says 24, and the current
  shell is **v26.5.0**. `npm ci` succeeded and everything passed, so this is not
  breaking — but a judge on Node 24 is fine and a judge on Node 26 gets an
  `EBADENGINE` warning. Consider relaxing to `>=24` or noting it.
- `docs/HACKATHON_EXECUTION.md` H-09 says "14 panels"; the live API returns
  **16**. `docs/SUBMISSION.md` correctly says 16. Stale internal doc.

### 3.3 Yesterday's blockers — current state

Credit where due. In ~10 hours the team closed most of a brutal audit.

| ID | Yesterday | Now |
|---|---|---|
| F1 | Headline regression was produced by the demo stopping PostgreSQL | ✅ **Fixed** — fault injection split into `demo:dependency-failure`; receipt shows error rate 0.00 % → 0.00 %, verdict rests on latency alone |
| B1 | Latency policy made the real regression unreportable (250 ms absolute) | ✅ **Fixed** — policy v2, `1.5×` **and** `+2 ms` resolution floor; verdict reason: "Observed p95 exceeded both 1.5x and baseline + 2ms" |
| B2 | Every SigNoz link on the flagship receipt was dead | ✅ **Fixed** — 24/24 links resolve |
| B3 | Timeline said "CI: failed" when CI passed | ✅ **Fixed** — `CI: Passed` |
| B4 | Three CI runs collapsed into one trace, unverified | ✅ **Fixed** — `exportState: verified`, per-run trace IDs |
| B5 | Both alert rules inert (`$service` unexpanded) | ✅ **Fixed** — both rules valid v5 and enabled (firing not re-observed by me) |
| B6 | A committed file told judges the project wasn't ready | ✅ **Fixed** — stale audit removed |
| B7 | **Landing page announces the demo is incomplete** | ❌ **STILL OPEN — see D1** |
| B8 | AI link `missing` on every change | ⚠️ **Unchanged, and correctly disclosed** — accept it; see D1/D6 for handling |
| B9 | `mcp:verify` passed without verifying | ✅ **Fixed** — resolves traces, fails loudly unauthenticated |
| B10 | Blog contained an impossible measurement | ✅ **Fixed** — commit `81444c1` "correct every published figure to the recorded run" |
| B11 | Dashboards opened empty | ✅ **Fixed** — 3 dashboards, 16 panels, real data |
| B12 | Foreign service polluted demo SigNoz | ✅ **Fixed** — ClickHouse census shows project services only |
| B13 | E2E didn't gate PRs | ⚠️ `browser` job exists in CI; coverage still one test (D9) |
| B14 | Minor UI/a11y gaps | ⚠️ Partially — D7, D8 |

---

## 4. Panel verdicts

### Judge 1 — Technical architecture · **8.5 / 10**

**First impression:** "This is not a hackathon codebase." Six-job CI with a
required gate, digest pins on every image, distroless non-root runtimes,
production-scoped SBOM, Trivy at a pinned commit. Then `npm run verify` goes
green in one command and 220 tests pass.

**Values:** the version-scoped comparison primitive; the third-party workload
that can't be accused of collusion; separating measurement from fault injection;
zero TODOs, zero `as any`, zero `@ts-ignore` across 12.5k lines.

**Questions:** why do baseline and candidate windows sit 10.5 h apart (D4)? Why
do all three deployments carry one image digest (D5)? Why three spans per
request (disclosed in H-09 — acceptable, but he'll ask)?

**Downgrade risk:** if the answer to D5 were "we didn't actually redeploy
anything," this collapses. It isn't — the config genuinely differs and
`versionState: verified` is real — but the receipt doesn't say so.

**Final comment:** *"Engineering-wise this is the strongest thing I'll see today.
Fix the two places where the receipt invites a question it can already answer."*

---

### Judge 2 — SigNoz / observability expert · **8.0 / 10**

**First impression:** genuinely deep. Query Builder v5 driving an actual
decision, not a chart. Three dashboards with declared nanosecond axes so p95
renders `10.45 ms` not `10450000`. An error-rate alert computed as a real
`A/B*100` formula rather than a count masquerading as a rate. Custom metrics that
emit zero for drained states because "a gauge that stops emitting is
indistinguishable from a collector that stopped" — that sentence alone tells him
someone has operated a system before.

**Values:** SigNoz is not removable. Delete it and there is no product. That is
the answer to his criterion and very few submissions will have it.

**Questions:** why does the MCP transcript say 32.89 % errors when the receipt
says 0.00 % (**D3 — this is the one that hurts**)? Why has no notification ever
been delivered to the webhook? Where is the service map?

**Downgrade risk:** D3. He is precisely the judge who opens both artifacts and
diffs the numbers. Unfixed, it costs a point and taints the honesty narrative;
fixed, he has nothing left to attack.

**Final comment:** *"Deepest SigNoz usage in the field. Re-capture that MCP
fixture before anyone else notices what I noticed."*

---

### Judge 3 — Product & UX · **5.5 / 10**

**First impression:** lands on `/`, reads *"4 change(s) recorded, but none has a
complete chain yet,"* sees a shell command, and forms the view that the project
does not work. There is no link to the receipt. If she is time-boxed, this is
where her evaluation ends.

**Values:** if she reaches the receipt — verdict-first layout, plain-language
badges, `1.4 ms → 10.4 ms +626%` above the fold, mobile that genuinely works, a
copyable revert command. It is a well-designed artifact.

**Questions:** why is the most alarming red badge in the product ("AI: Missing")
on every single row? Why does the `<h1>` promise AI-session tracing on a page
that reports none?

**Downgrade risk:** the landing page, alone. Everything else is 7.5-quality.

**Final comment:** *"The product behind the front door is good. The front door
says 'closed'."*

---

### Judge 4 — Business value & innovation · **8.5 / 10**

**First impression:** the framing is excellent and the timing is perfect. "AI
writes the change, CI blesses it, production pays, and no one can join those
facts" is the operational problem of 2026, and it maps to SigNoz's own issue
#11657.

**Values:** "change receipt" and "flight recorder" are memorable, ownable nouns.
The refusal semantics — a product that says `missing` rather than rendering a
confident blank — is a real product philosophy, not a feature list.

**Questions:** does this generalise past one route on one service? (Honestly
disclosed: the scope is parameterised; baseline selection is the real
constraint.) Who buys it — platform teams, or is it a GitHub feature in a year?

**Downgrade risk:** low. He may discount for single-route scope.

**Final comment:** *"Best-articulated problem in the field. I'd want to see the
second service, but the idea earns the benefit of the doubt."*

---

### Judge 5 — Security & production readiness · **8.0 / 10**

**First impression:** checks `.gitignore`, greps for secrets, finds nothing.
Non-root UID 65532, read-only filesystems, dropped capabilities,
`no-new-privileges`, loopback-only bindings, mode-0600 generated secrets,
no ClickHouse/Postgres published to host. Production dependency tree clean;
images scan zero high/critical.

**Values:** the supply-chain discipline — six images pinned by manifest digest
and *verified at runtime* before the demo may claim anything. Most teams pin
tags and call it pinning.

**Questions:** the SQLite→Postgres dual-driver surface; whether
`GREENLIGHT_REQUIRE_READ_AUTH=false` is demo-only; the 13 skipped tests.

**Downgrade risk:** low. This is the most defensible axis in the project.

**Final comment:** *"Production-grade posture. I have essentially no findings,
which almost never happens at a hackathon."*

---

### Judge 6 — Demo & storytelling · **4.5 / 10** (→ 8.0 with D1+D2 fixed)

**First impression:** **there is no video.** That is the entire first impression.
If the form requires one, he may not score the project at all.

**Values:** the narrative is genuinely great when told — eight green checks, one
config line, 7.3×, a verdict computed from telemetry, a revert that recovers it,
and a system that refuses to overclaim. The script in `docs/VIDEO_SCRIPT.md` is
well-constructed and correctly paced.

**Questions:** why does the README's first line say an AI wrote the change when
the receipt says no AI session is linked (D6)?

**Downgrade risk:** maximal. This axis is currently scoring a text file.

**Final comment:** *"Everything needed for a 9 is written down. None of it has
been recorded. This is the cheapest three points on the board."*

---

## 5. Scorecard

**Weighting is an estimate.** No official weights are published; equal 1/6 is
assumed and labelled as such.

### 5.1 Against official criteria

| # | Criterion | Weight | Current | Projected | Rationale for the gap |
|---|---|---|---|---|---|
| 1 | Potential Impact | 16.7 % | **8.5** | 8.7 | Problem is real, current, and matches SigNoz's own issue. D6 slightly undercuts. |
| 2 | Creativity & Innovation | 16.7 % | **8.5** | 8.5 | Flight recorder + refusal semantics + version-scoped verdict. Already near ceiling. |
| 3 | Technical Excellence | 16.7 % | **8.5** | 9.0 | Exceptional. D4/D5 are presentation of technique, not technique. |
| 4 | Best Use of SigNoz | 16.7 % | **8.0** | 8.7 | Traces decide the verdict. Docked for D3, undelivered notifications, no service map. |
| 5 | User Experience | 16.7 % | **5.5** | 7.5 | Entirely D1. The receipt itself is 7.5-quality work. |
| 6 | Presentation Quality | 16.7 % | **4.5** | 8.0 | Blog unpublished, no video. Pure execution gap, not a quality gap. |
| | **Weighted total** | 100 % | **7.25 / 10** | **8.40 / 10** | |

### 5.2 Supplementary dimensions (auditor's own, not official)

| Dimension | Score | Note |
|---|---|---|
| Problem clarity | 9.0 | Sharpest framing in the likely field |
| Technical difficulty | 8.5 | Version-scoped verdicts + CI trace reconstruction + MCP |
| Implementation completeness | 8.0 | Everything claimed exists; AI link honestly unarmed |
| Reliability | 8.0 | Health-gated, typed failures, degraded paths tested |
| Scalability / extensibility | 6.5 | One route, one service; scope parameterised but unproven |
| Documentation | 8.5 | Excellent and unusually honest; two stale figures |
| Ease of setup | 7.0 | One command, but a mandatory manual SigNoz-key gate |
| Reproducibility | 9.0 | Digest-pinned and runtime-verified. Best-in-class. |
| Demo quality | 3.0 | No video exists |
| Rule compliance | 8.0 | Compliant except the two unpublished artifacts |
| Differentiation | 8.5 | The third-party workload and refusal semantics stand out |

---

## 6. Competitive position

**Track fit:** **Track 03 — Build Your Own** is correct and already declared. It
has a real claim on **Track 01 (AI & Agent Observability)** too — coding-agent
traces, MCP-driven investigation — but Track 01 will be the crowded track (every
LLM-observability dashboard lands there) and GreenLight's AI link is its *weakest*
verified component. Track 03 is the better-differentiated field. **Do not switch.**

**What the field will look like:** mostly LLM/agent tracing dashboards, a few
SRE-copilot chatbots over the MCP server, some OpenTelemetry instrumentation
showcases, and a long tail of "I sent data to SigNoz and made a dashboard."

**What beats GreenLight:** a submission with a comparable idea and a *polished
three-minute video plus a live hosted demo*. Presentation is where this project
is weakest and where a lesser project can out-score it. Also: a team that
demonstrates SigNoz's MCP agentically and *live* — GreenLight's MCP usage is a
recorded fixture, which is more rigorous but less thrilling on camera.

### Why it could win

1. SigNoz is genuinely load-bearing — the strongest possible answer to 1/6 of the score.
2. The third-party, uncooperative workload makes the regression credible in a way self-instrumented demos never are.
3. Engineering quality is not close to typical hackathon output.
4. Refusal semantics give it a philosophy, and philosophies are what judges remember at the end of a long day.
5. It fixes a problem SigNoz has itself filed an issue about.

### Why it could lose

1. **No video** — possibly fatal at screening.
2. **The landing page says the demo is incomplete** — kills the UX score and possibly the whole read.
3. D3 hands the SigNoz expert a contradiction between two of its own artifacts.
4. The AI link — the headline noun — is `missing` everywhere, and the README claims it anyway (D6).
5. Local-only. No hosted URL for a judge who won't run Docker.
6. Single route, single service.

### Estimated probabilities

Ranges, not points. Assumes the deadline holds and the project is submitted.

| Outcome | If submitted **as-is right now** | If **D1 + D2 + D3** are done |
|---|---|---|
| Passes initial screening | **50 – 65 %** (video absence is the risk) | **90 – 96 %** |
| Reaches finalist / shortlist in Track 3 | **30 – 45 %** | **60 – 75 %** |
| Places in a prize category (Track 3 has one prize) | **15 – 25 %** | **30 – 45 %** |
| "Wins the hackathon overall" | **n/a — no such prize is published.** Best-of-panel hypothetical: 8 – 15 % | 15 – 25 % |

No outcome here can be guaranteed. The largest single movement available is
**recording the video** — it is worth more probability than every code change in
this document combined.

---

## 7. Prioritized plan for the remaining ~3 hours

Ordered for execution, not by category. **Start T1 immediately** — it is the long
pole and it does not depend on any code change.

### CRITICAL — do not submit without these

---

**T1 · Record the video and publish the blog** — *ESSENTIAL*

- **Exact change:** publish `docs/BLOG.md` to Dev.to. Record ≤3 min against `docs/VIDEO_SCRIPT.md`, upload unlisted to YouTube.
- **Why judges care:** Presentation Quality is 1/6 of the score and both are form fields. Missing video risks screening failure, not just points.
- **Score impact:** Presentation 4.5 → 8.0 (**+0.58 weighted**). Largest single item.
- **Difficulty:** Low skill, high time. **~90 min** (15 blog, 60–75 video).
- **Risk:** Medium — retakes eat the clock. Mitigate: one rehearsal, accept take 2.
- **Dependencies:** Ideally record *after* T2 so the landing page looks right on camera. If time gets tight, record anyway and start on `/changes/2fa6e28…`.
- **Demonstrate:** the video *is* the demonstration.

---

**T2 · Fix the landing page to feature the receipt** — *ESSENTIAL*

- **Exact change:** in `apps/web/src/features/landing/featured.ts`, stop requiring `aiVerificationState === "verified"` for eligibility. Select the best available change (prefer `recovered`, then `regressed`) wherever a decided verdict exists. In `LandingPage.tsx`, render the four links as a checklist — CI ✅, Deployment ✅, Verdict ✅, AI session ⚠️ *not linked* — and always show "Open the receipt". Update `landing.test.tsx`.
- **Why judges care:** it is the first screen. Currently it reports the project's own demo as incomplete and hides the hero artifact.
- **Score impact:** UX 5.5 → 7.5, Presentation +0.5 (**+0.42 weighted**).
- **Difficulty:** Low. **~25 min** including tests.
- **Risk:** Low. Isolated module with existing test coverage.
- **Dependencies:** none. Run `npm run verify` after.
- **Demonstrate:** open `/` on camera — readiness green, receipt one click away, AI link honestly marked *not linked*.
- **Guardrail:** do **not** fake the AI link to green. The honest checklist is a strength; the hidden hero is the bug.

---

**T3 · Re-capture the MCP fixture** — *ESSENTIAL*

- **Exact change:** run `npm run mcp:capture` with `BASELINE_SHA=6f458c9…`, `CANDIDATE_SHA=2fa6e28…`; then `npm run mcp:verify`; then update the result table in `docs/MCP_DEMO.md`.
- **Why judges care:** removes a live contradiction between the MCP transcript (32.89 % errors) and the receipt (0.00 %) for the same commit.
- **Score impact:** Best Use of SigNoz +0.5 (**+0.08 weighted**), plus removes tail risk of a much larger honesty penalty.
- **Difficulty:** Low. **~10 min.**
- **Risk:** Low — capture fails loudly if MCP can't answer. Verify the new `window` contains 19:20–19:22 UTC before committing.
- **Dependencies:** stack running (it is), `.env.demo` sourced.
- **Demonstrate:** show the transcript beside the receipt; the numbers now agree.

---

### HIGH-VALUE — do these if T1–T3 finish with time left

---

**T4 · Reconcile the three honesty gaps in the narrative** — *HIGH-VALUE*

- **Exact change:** three edits, ~15 min total.
  1. `README.md:3` — make the opener archetypal ("An AI writes a one-line config change…") so it stops claiming an AI session the receipt reports as `missing` (D6).
  2. Receipt — add one line under the window pair explaining the frozen baseline (D4). Fix `README.md:105`'s "about ten minutes" to describe the candidate+recovery phases.
  3. Receipt — label the digest `Image digest (unchanged — this is a configuration change)` (D5).
- **Why judges care:** each converts a question a judge *will* ask into an answer already on the page.
- **Score impact:** Technical Excellence +0.5, Presentation +0.3 (**+0.13 weighted**).
- **Difficulty:** Low. **~15 min.** **Risk:** none — text only.
- **Demonstrate:** these are what let you answer §11 Q2–Q4 in one sentence each.

---

**T5 · Re-tone the `AI: Missing` badge** — *HIGH-VALUE*

- **Exact change:** in `apps/web/src/status.ts`, give `missing` a neutral/amber tone distinct from failure red; relabel `AI: not linked`.
- **Why judges care:** stops the change list reading as four broken rows.
- **Score impact:** UX +0.3 (**+0.05 weighted**). **Difficulty:** Low, **~10 min.** **Risk:** Low — tone assertions exist in tests; update them.

---

**T6 · Demo hygiene before recording** — *HIGH-VALUE, 5 min*

- `docker stop lms-postgres lms-rabbitmq lms-redis` so `docker ps` is clean on camera.
- Confirm the SigNoz services list shows only project services (`greenlight-smoke` will appear — harmless, or wait it out of the window).
- Re-run `npm run demo:status`, `npm run verify:receipt-links`, `npm run mcp:verify` immediately before hitting record.

---

### OPTIONAL — only if everything above is done

| Task | Value | Time | Note |
|---|---|---|---|
| **T7** Assert MCP window contains the receipt window in `verify-mcp-result.mjs` | Makes D3 structurally impossible; great story for Judge 2 | 15 min | High ratio if time exists |
| **T8** One E2E assertion that `/` links to a receipt | Protects T2 | 10 min | Cheap insurance |
| **T9** Relax `engines` to `>=24` | Removes an `EBADENGINE` warning on modern Node | 2 min | Trivial |
| **T10** Fix `docs/HACKATHON_EXECUTION.md` "14 panels" → 16 | Internal consistency | 2 min | Only if idle |

### Explicitly **do not** attempt before the deadline

Service map (H-15), accessibility gate (H-20), GitHub Check publisher (H-23),
evidence-completeness score (H-24), second workload adapter (H-25), deploying a
hosted demo, or arming the AI link end-to-end. Each is real work with a poor
score-per-minute ratio at T-3h, and each risks destabilising a currently-green
stack.

---

## 8. Recommended live-demo sequence (3:00)

| Time | Screen | Beat |
|---|---|---|
| 0:00–0:18 | PR #64 checks tab, 8 green | "A one-line config change. Eight checks. All green. It shipped." |
| 0:18–0:35 | GreenLight `/` (post-T2) | "GreenLight records what happened next. Three dependencies healthy, one verified chain." |
| 0:35–1:05 | The receipt, top | "Regressed. p95 1.4 ms → 10.4 ms, +626 %, on `/balances`. That verdict is computed from trace data, not asserted." |
| 1:05–1:30 | SigNoz Deployment Impact dashboard | "Same comparison, grouped by `service.version`. Two series, one chart. The step between them is the deployment." |
| 1:30–1:50 | SigNoz Alerts | "The p95 rule follows whatever is deployed — it doesn't pin a version, because a version-scoped rule can only describe a version that already existed." |
| 1:50–2:10 | Receipt evidence links, click one | "Every link is an ID that must resolve in a live SigNoz. `verify:receipt-links` checks all 24." |
| 2:10–2:30 | MCP transcript beside receipt | "An agent asked SigNoz the same question over MCP and got the same answer. No direct-API fallback — this could only have come from MCP." |
| 2:30–2:45 | Recovery panel | "The revert recovered it: 2.1 ms. Recovery is measured, not assumed." |
| 2:45–3:00 | AI link `not linked` + caveat | "One link isn't armed, and the receipt says so rather than rendering a confident blank. That refusal is the product." |

**Close on the caveat.** Ending on what the system declines to claim is the
single most memorable thing available, and it inoculates against every
causation question.

---

## 9. Concise submission description (paste-ready)

> **GreenLight — AI Change Flight Recorder**
>
> An AI writes a one-line config change. It passes all eight CI checks, gets
> reviewed, merged, and deployed. p95 latency on the affected endpoint then rises
> 7.3×. Nothing in the toolchain connects those facts.
>
> GreenLight records that gap. It ties a coding-agent session to the commit it
> produced, the CI run that validated it, the immutable deployed version, and the
> SigNoz telemetry that followed — then decides from trace data whether the change
> regressed the service, and whether a later change recovered it.
>
> SigNoz is the evidence system, not a dashboard bolted on. Two Query Builder v5
> queries per window return count, p90, p95 and error count, each scoped to one
> immutable `service.version`, so "before and after" is a version comparison
> rather than an ambiguous wall-clock one. Three dashboards (16 panels), two
> alert rules that follow whatever is deployed, custom `greenlight.*` metrics,
> OTLP logs correlated to spans by `commit_sha`, and an MCP transcript captured
> over streamable HTTP from the SigNoz MCP server.
>
> The monitored workload is Blnk v0.15.1, a third-party Apache-2.0 financial
> ledger, fetched and verified rather than vendored. It knows nothing about
> GreenLight, so a detected regression is not one written to be detected.
>
> Every link is an ID that must resolve in a live SigNoz — `verify:receipt-links`
> checks all 24. When one does not resolve, the receipt says so rather than
> rendering a confident blank. Every receipt carries the same caveat: deployment
> correlation is evidence of temporal and version association, not proof of
> causation.
>
> Track 3 — Build Your Own. Stack pinned by manifest digest and verified at
> runtime before the demo is permitted to claim anything.
>
> *AI assistance disclosure: Claude Code, Codex/ChatGPT and Cursor were used for
> planning and implementation. All commits are authored and reviewed under the
> human maintainer's verified Git identity. See PROVENANCE.md.*

---

## 10. Assets to capture

**Screenshots (5 exist and are current; regenerate after T2):**

1. `/` landing — three healthy dependencies **and a live receipt link** ← must be re-shot after T2
2. `/changes` list — four changes, semantic badges ← re-shot after T5
3. The regressed receipt, full page — verdict banner above the fold
4. Receipt on mobile — proves responsive
5. Receipt for an unknown SHA — proves the honest 404 path

**SigNoz captures (new — none of these exist yet and all are cheap):**

6. **Deployment Impact dashboard**, `service.version` grouping, both series and the step. *This is the most persuasive single image in the whole submission and it is not currently captured.*
7. **Alerts page** with the p95 rule visible
8. **A trace detail view** reached by clicking a receipt evidence link — proves the ID resolves
9. **Logs filtered by `commit_sha`** resolving to a span — proves correlation
10. **Self Observability dashboard** showing `greenlight.*` custom metrics

**Failure scenarios worth showing (all already work — pick one for the video):**

- Unknown commit SHA → typed 404, not `200 null`
- `npm run mcp:verify` without a key → refuses to pass, prints the remedy
- `npm run ai-link:verify` → names which of four links is unarmed
- `npm run demo:dependency-failure` → `regressed`, and **refuses to attribute** the failures to the commit
- Stop Postgres → `/readyz` 200 → 503 with `database=failed`, recovers without restart

If you only capture one new asset: **#6**.

---

## 11. Likely judge questions, with strong answers

**Q1. "Did you engineer the regression?"**
> The *change* is deliberate — a plausible one-line pool-tuning tweak,
> `conn_max_lifetime: 1000000`, the kind an agent writes daily. The *detection*
> is not. The workload is Blnk, a third-party Apache-2.0 ledger fetched at a
> pinned commit, which has no knowledge of GreenLight. Nothing in the measurement
> path was written to find this particular fault, and the demo injects nothing —
> fault injection is a separate, explicitly-named scenario.

**Q2. "Your regressed and recovered deployments have the same image digest."** *(D5)*
> Correct — and that's the point. The artifact is byte-identical; only the
> configuration differs. Config changes are exactly the class that slips through
> CI, and exactly why the unit of comparison is `service.version` rather than an
> image. The digest proves *what* ran; the version proves *which change* ran.

**Q3. "Your baseline and candidate windows are ten hours apart."** *(D4)*
> The baseline is a frozen last-known-good deployment, reused across rehearsals
> by design. The comparison is scoped to an immutable `service.version`, not a
> wall-clock window, so elapsed time between captures doesn't enter the
> comparison. And the effect is 7.3× on a 1.4 ms route — nine milliseconds is not
> ambient drift.

**Q4. "Your AI link says `missing` on every change. Isn't that the whole product?"**
> It's one of four links, and it's the one I refused to fake. Marking it
> `verified` requires a Claude Code session exporting telemetry to SigNoz so the
> exact span resolves; these commits weren't authored that way, so the receipt
> reports `missing`. `docs/AI_LINK.md` is the procedure and `ai-link:verify`
> reports which of the four links isn't armed. A system that claims a link it
> can't resolve is the failure mode this product exists to prevent.

**Q5. "How is this different from Datadog deployment tracking?"**
> Two things. It starts one step earlier — at the agent session that authored the
> change, not the deploy event. And it produces a verdict with stated refusal
> semantics rather than a chart: `regressed`, `recovered`, `insufficient_data`,
> `integration_error`, each with the evidence that produced it and a caveat about
> what it does not prove.

**Q6. "Can you prove the alerts actually fire?"**
> Both rules are valid Query Builder v5 and enabled; the error-rate rule computes
> a true rate as `A/B*100`, not a count. The p95 rule was observed going
> `inactive` → `firing` under the regressed version and back on the revert. What
> I have *not* observed is SigNoz delivering to the webhook — the receiver
> authenticates and records notifications as logs and metrics, so what's unproven
> is dispatch, not handling. That's stated in the submission rather than glossed.

**Q7. "Does this scale past one route on one service?"**
> The query scope is already parameterised on service, version, environment and
> route. The real constraint is baseline selection — today it's the previously
> frozen good deployment rather than a rolling window of healthy versions. That's
> the next piece of work, and it's a policy change, not an architecture change.

**Q8. "Why should I trust any of these numbers?"**
> Don't — check them. `verify:receipt-links` resolves all 24 published links.
> `mcp:verify` resolves every cited trace and fails loudly without credentials.
> `signoz-runtime-verify.sh` matches six image digests. Every claim in the README
> has a command next to it.

---

## 12. Final checklists

### Repository
- [x] Public, MIT licensed, described
- [x] `casting.yaml` + `casting.yaml.lock` at root, digest-pinned
- [x] README leads with architecture and a proof table
- [x] AI assistance disclosed (README + PROVENANCE.md)
- [x] No secrets tracked; `.env*` ignored except examples
- [x] CI green on `main`
- [ ] **T2** landing page features the receipt
- [ ] **T3** MCP fixture re-captured
- [ ] **T4** README opener, baseline-window note, digest label
- [ ] Screenshots regenerated after T2/T5

### Submission form
- [ ] Track 3 selected
- [ ] Repo URL
- [ ] **Blog URL (T1)**
- [ ] **YouTube URL (T1)**
- [ ] Description pasted from §9
- [ ] "How SigNoz is used" pasted from `docs/SUBMISSION.md`
- [ ] **AI assistance declared in the form itself** — not only in the repo. The rules make non-disclosure a disqualification.
- [ ] Submitter name matches the GitHub account owner
- [ ] **Deadline confirmed on the form**, not from `docs/SUBMISSION.md`

### Video
- [ ] ≤ 3:00
- [ ] Opens on 8 green checks
- [ ] Shows the receipt, a SigNoz dashboard, and one resolving link
- [ ] Closes on the caveat
- [ ] Browser at ~125 %; no unrelated containers or tabs visible
- [ ] Audio checked before the full take

### Pre-record commands
```bash
docker stop lms-postgres lms-rabbitmq lms-redis
npm run demo:status
npm run verify:receipt-links
set -a && . ./.env.demo && set +a && npm run mcp:verify
```

---

## 13. The ten actions that most change the outcome

Ranked by probability moved per minute spent.

1. **Record the video.** (~70 min) Nothing else competes. Missing it risks the whole submission.
2. **Publish the blog to Dev.to.** (~15 min) Form requirement; near-zero effort.
3. **Fix the landing page to feature the receipt (T2).** (~25 min) Removes the worst first impression in the project.
4. **Re-capture the MCP fixture (T3).** (~10 min) Eliminates the only self-contradiction a judge can weaponise.
5. **Fix the README's opening sentence (D6).** (~5 min) Stops the project retracting its own headline.
6. **Capture the Deployment Impact dashboard screenshot.** (~5 min) Most persuasive image available, currently missing.
7. **Explain the frozen baseline on the receipt (D4).** (~10 min) Converts the likeliest hostile question into a design point.
8. **Label the unchanged image digest (D5).** (~5 min) Same, for the second-likeliest question.
9. **Re-tone `AI: Missing` → `AI: not linked` (T5).** (~10 min) Stops the list reading as four broken rows.
10. **Declare AI assistance in the form itself.** (~1 min) Rules make omission a disqualification. Do not skip because it's in the README.

**Total: ~2 h 40 m** against ~3 h 15 m remaining. It fits, but only if the video
starts now and the code changes happen while it renders and uploads.

---

## 14. Honest closing assessment

This is a strong project being undersold by two unfinished chores and one
fifteen-line function.

The engineering is not in question — I went looking for hacks, mocks, hardcoded
demo behaviour and over-abstraction, and found essentially none: no TODOs, no
`as any`, no fake data paths, no dead scaffolding. The SigNoz integration is
load-bearing in the strict sense that removing it removes the product. The design
philosophy — a system that refuses to claim what it cannot resolve — is the kind
of thing a judging panel still remembers at the end of a long day.

What is in question is whether a judge will ever see any of it. Right now the
front door reports the demo as incomplete, there is no video, and the MCP
transcript disagrees with the receipt. Those three facts are worth more than a
point of score each, and all three are fixable in the time remaining.

Fix them and this is a credible Track 3 winner. Ship it as-is and it is a project
that will be remembered by whoever happened to read past the landing page.
