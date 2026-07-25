# GreenLight Hackathon Judging Audit

Audit date: 25 July 2026 (IST)  
Repository: `/Users/siddhant/Desktop/hackathon`  
Target event: Agents of SigNoz, WeMakeDevs × SigNoz  
Intended entry: Track 3 — Build Your Own

## Executive verdict

GreenLight has a prize-worthy idea and substantially better engineering discipline than the average hackathon repository. Its core insight is sharp: an AI-authored change can pass CI and still damage production, so the change needs an auditable chain from AI session to commit, CI, immutable deployment, SigNoz before/after telemetry, and recovery. The project is careful about provenance, separates reconstructed telemetry from native telemetry, persists evaluation windows and thresholds, refuses to overclaim causality, and treats SigNoz as the evidence system rather than a decorative dashboard.

The current artifact is **not submission-ready** and would be risky to demo to judges. A clean build and 137 passing automated tests are real strengths, but the live evidence chain advertised by the concept could not be reproduced from the checked-out project:

- the documented preflight fails because this machine has Node 26 instead of the required Node 24;
- the checked-in `.env` contains placeholder GitHub, SigNoz, and admin credentials;
- Docker starts only after an audit-only token override and then reports GitHub and SigNoz as degraded;
- the real monitored LMS workload is private and the required immutable SHAs/images are absent;
- Foundry configuration validates and forges, but the generated stack uses floating `latest` images and requires unconfigured digest pins and secrets before it is safe to start;
- no real SigNoz UI, MCP query, imported dashboard, fired alert, or resolvable production trace was available for verification;
- the mandatory new SigNoz project blog and ≤3-minute YouTube demo are not present;
- the default UI is an almost blank empty state.

**Current judging score: 64/100.**  
**Projected score after the critical fixes: 83–87/100.**  
**Current submission readiness: No.**  
**Current finalist quality: Architecture yes; submitted artifact no.**  
**Capable of winning: Yes, particularly Track 3, if the end-to-end evidence becomes real, visible, and explainable before submission.**

## Official event and submission facts

The official [hackathon overview](https://www.wemakedevs.org/hackathons/signoz) lists six judging criteria without weights:

1. Potential Impact
2. Creativity & Innovation
3. Technical Excellence
4. Best Use of SigNoz
5. User Experience
6. Presentation Quality

This audit therefore uses equal weights rather than inventing organizer weights. The same page describes three independent prize tracks. It does not publish a separate “overall winner” category, so any “overall win” probability below is only a hypothetical panel-best estimate, not an official prize category.

The [official rules](https://www.wemakedevs.org/hackathons/signoz/rules) require SigNoz integration, `casting.yaml` and `casting.yaml.lock`, Foundry including MCP, original work begun after the event started, and disclosure of AI assistance. The repository satisfies the casting-file, timing, license, and AI-disclosure requirements on inspection. Its first commit is dated 23 July 2026, after the event began on 20 July.

The [official schedule](https://www.wemakedevs.org/hackathons/signoz/schedule) lists the submission deadline as 26 July 2026 at 5:29 AM IST. The official submission form additionally requires:

- one selected track;
- a project description;
- a public GitHub link including the casting files;
- a YouTube demo no longer than three minutes, covering the project, architecture/technology, and preferably a demo;
- a description of how SigNoz is used;
- a **new, detailed project blog** about the SigNoz implementation;
- a short account of the hackathon experience;
- an optional deployed link.

The repository does not contain or link the required project blog or demo video. If those fields remain missing, the project is not merely lower-scoring—it cannot complete the required form.

There are no previous winners for this still-running event. As a limited benchmark, official WeMakeDevs winner galleries for [FutureStack](https://www.wemakedevs.org/hackathons/futurestack25/projects) and [Hackfrost](https://www.wemakedevs.org/hackathons/hackfrost24/projects) favor products that turn the sponsor technology into an immediately legible, polished workflow rather than a repository of latent capability. That comparison is suggestive, not a direct predictor.

## Scorecard against the official judging criteria

| Official criterion | Current score | Evidence and judgment |
|---|---:|---|
| Potential Impact | 8.2/10 | AI change accountability is timely and meaningful. The “flight recorder” frame is memorable and useful to real platform/SRE teams. Value is diluted by the absence of a usable deployment and by production claims being explicitly gated. |
| Creativity & Innovation | 8.6/10 | The traceparent Git trailer, explicit reconstructed-CI origin, immutable version windows, evidence receipt, and recovery chain are differentiated. This is more original than another chatbot over telemetry. |
| Technical Excellence | 6.8/10 | Monorepo boundaries, schemas, typed Query Builder client, persistent jobs, redaction, retry semantics, container hardening, CI structure, and 137 passing tests are strong. Live integrations are skipped/unconfigured; two concrete receipt defects exist; production dependencies still report high vulnerabilities; casting is not image-immutable. |
| Best Use of SigNoz | 5.5/10 | SigNoz is conceptually central: traces, trace-derived latency/error queries, dashboards, alerts, logs, deployment markers, Query Builder v5, MCP, and links back to evidence. But the audit could not verify a running SigNoz, a genuine MCP result, imported/rendered dashboards, a fired/resolved alert, or live trace IDs. Custom metrics are not meaningfully implemented, and one “error rate” alert counts all spans. |
| User Experience | 5.2/10 | The populated receipt is clean, responsive, semantically structured, and cautious about evidence state. The normal first-run experience is a blank sentence; all list badges look neutral; errors collapse into generic text; there is no navigation, judge onboarding, status visibility, or dominant verdict. |
| Presentation Quality | 4.4/10 | Documentation is unusually honest and thorough, but it reads as remediation/operations material rather than a judge-facing pitch. There is no mandatory blog, video, live link, verified proof gallery, or three-minute narrative. |
| **Equal-weight total** | **64/100** | Strong concept and engineering foundation; weak live proof, submission packaging, and demo legibility. |

### Competition viability

- **Current screening probability:** 30–45%. If the mandatory blog/video are absent at form time, practical submission probability is 0%.
- **Current finalist probability:** 10–20%.
- **Current Track 3 prize probability:** 3–8%.
- **Hypothetical overall/panel-best probability:** 1–3%; no official overall category is published.
- **After critical fixes:** screening 85–95%, finalist 45–65%, Track 3 prize 15–30%, hypothetical panel-best 8–15%.

These are subjective estimates, not statistical forecasts. The largest uncertainty is the field quality and whether judges evaluate from a live demo, the repository, or both.

## Six judge personas

### 1. Technical architecture judge — 7.5/10

**Reaction:** “This team understands provenance, idempotency, failure semantics, and evidence boundaries.”  
**Would reward:** shared contracts, persistent queue, retries/deadlines, explicit version and trace states, normalized GitHub data, typed SigNoz client, container hardening, honest reconstruction labels.  
**Would challenge:** “Show me a clean-clone run with the real workload and live SigNoz. Why are integrations skipped? Why are images floating? Why does the 404 path return `200 null`?”

### 2. Observability/SigNoz judge — 5.5/10

**Reaction:** “The intended workflow matches SigNoz’s own before/after release-investigation story, but I need proof in SigNoz.”  
**Would reward:** exact service-version and route windows; deployment marker traces; p90/p95/error evidence; trace links; Query Builder v5; dashboards, alerts, logs, and MCP represented in the architecture. This aligns with SigNoz’s documented [MCP capabilities](https://signoz.io/docs/ai/signoz-mcp-server/), [Query Builder v5](https://signoz.io/docs/userguide/query-builder-v5/), [dashboard](https://signoz.io/docs/userguide/manage-dashboards/), [alert](https://signoz.io/docs/alerts/), and [release comparison](https://signoz.io/blog/signoz-mcp-development-release-lifecycle/) workflows.  
**Would challenge:** “Where is the live trace waterfall? Where is the MCP call? Where is the fired alert? Which real metrics and logs are indispensable? Why is the error-rate alert a count threshold?”

### 3. Product and UX judge — 5.4/10

**Reaction:** “The receipt is understandable once populated, but the product does not teach or guide me.”  
**Would reward:** one artifact connecting AI, CI, deploy, regression, and recovery; clear verification labels; safe wording; mobile reflow; one-click revert-command copying.  
**Would challenge:** “What should I do on the blank first screen? What is the verdict? Which evidence is missing? Why do regression and success badges look the same? How do I go back?”

### 4. Innovation/business judge — 8.0/10

**Reaction:** “This is a credible platform product concept with a memorable frame.”  
**Would reward:** strong timing around AI-generated changes; team-facing trust and accountability; potential GitHub/CI/SRE integration; reusable audit receipt.  
**Would challenge:** “Who buys it, who operates it, and why is this more than a dashboard? What is the smallest adoption path? Can it work without a private bespoke LMS?”

### 5. Security and production-readiness judge — 5.5/10

**Reaction:** “The authors know what production-readiness requires, but their own gates say it is not there yet.”  
**Would reward:** loopback ports, non-root/read-only containers, scoped auth, CORS/rate limits, redaction, secret scanning, SBOM/Trivy jobs, fail-closed evidence verification, PostgreSQL production gate.  
**Would challenge:** “Show the passing dependency audit and live PostgreSQL/restore evidence. Why do production images still contain two high-severity vulnerabilities? Why can local Docker come up healthy while the essential GitHub and SigNoz dependencies are broken?”

### 6. Demo and storytelling judge — 4.5/10

**Reaction:** “The story is strong on paper, but the default demo is blank and the real chain is unavailable.”  
**Would reward:** the green-CI/bad-production hook and the before/candidate/recovery arc.  
**Would challenge:** “Can you prove the result in three minutes without terminal archaeology? Where is the YouTube video, new project blog, live dashboard, and final recovered state?”

## What was actually run

| Audit step | Result | Health |
|---|---|---|
| Repository structure, history, docs, provenance, CI, security, and configuration inspection | Completed | Healthy |
| `npm ci` | Completed; engine warning because host is Node 26 while project requires Node 24 | Warning |
| `npm run verify` | Passed | Healthy |
| Automated tests inside verify | Shared 24; API 102 passed/12 skipped; Web 11; LMS load 2 — **137 passed, 12 skipped** | Healthy with live-integration gap |
| Lint, typecheck, production build | Passed | Healthy |
| Quality policy over 228 tracked files | Passed | Healthy |
| Config, telemetry fixture, dashboards/alerts schema, compiled migrations, Git-hook tests, Compose config | Passed | Healthy |
| Web production bundle | 334.61 kB; 99.87 kB gzip | Healthy |
| `npm run test:coverage` | Failed because a coverage package file was missing under the unsupported Node 26 install; no thresholds are configured | Warning |
| Compiled-start test | Could not bind a host port in the sandbox; later Docker runtime verified API/web startup | Inconclusive locally |
| `scripts/preflight.sh` | Failed immediately: Node 24 required, Node 26 found; required real-evidence variables also absent/placeholders | Unhealthy for this checkout |
| Docker image builds | API, worker, and web built on Node 24.4.1 | Healthy |
| Docker Compose with checked-in environment | Failed: placeholder admin token length invalid | Unhealthy |
| Docker Compose with audit-only valid token override | API `/livez` 200; `/readyz` 200; web `/healthz` 200 | Runtime healthy, dependencies degraded |
| Dependency status | Database OK; GitHub failed; SigNoz failed; endpoint returned 503 degraded | Unhealthy |
| Real background job | `github_sync_latest` retried five times then failed with GitHub 401; logs included trace/span IDs | Correct failure handling, unusable credentials |
| Foundry `gauge` | Passed | Healthy |
| Foundry `forge` | Passed and reproduced generated Compose | Healthy structurally |
| Foundry/SigNoz `cast`, smoke, live imports, MCP capture/verification | Not run: required digest-pinned images, security secrets, live service account, and safe configuration were unavailable | Blocked |
| Live PostgreSQL adapter tests | 8 skipped without live PostgreSQL | Blocked |
| Live SigNoz integration tests | 4 skipped without live SigNoz/API key | Blocked |
| Dependency audit | Image build reported 4 vulnerabilities before prune and 2 high vulnerabilities in production dependencies; package-level report could not be fetched because external registry access was denied | Unhealthy/unresolved |
| Desktop and mobile UI walkthrough | Completed with empty, populated audit-seed, receipt, copy, responsive, and error states | Mixed |

The temporary audit containers and network were stopped and removed after inspection. The named data volume was intentionally preserved because deleting it would be destructive. The populated UI used explicitly synthetic, audit-only seed data; it is usability evidence, not project or SigNoz proof.

## Repository and engineering assessment

### What is strong

- The README plainly says the evidence chain is not complete instead of laundering fixtures into claims.
- `PROVENANCE.md` and the README disclose AI assistance, satisfying a disqualification-sensitive rule.
- The first commit falls inside the official event window.
- The monitored LMS is clearly separated as a pre-existing workload rather than presented as hackathon work.
- The application persists exact comparison windows, thresholds, policy version, counts, versions, image digests, and evidence verification state.
- Reconstructed CI spans are labeled `greenlight.telemetry.origin=reconstructed` and linked rather than misrepresented as native GitHub traces.
- The Query Builder client validates inputs and distinguishes no data from dependency failure.
- The worker uses persistent jobs, bounded retry/backoff, idempotency, and structured trace-correlated logging.
- Verification is fail-closed: links are withheld until authoritative evidence resolves.
- The receipt explicitly says deployment correlation is not causal proof.
- Main CI is thoughtfully structured with pinned actions, least-privilege permissions, security scans, image tests, and a required gate.
- Containers are loopback-bound, non-root, read-only, resource-limited, and have health checks.

### Concrete defects and gaps

1. **Missing receipts return the wrong HTTP behavior.** In `apps/api/src/app.ts:262`, `getReceipt(...)` is asynchronous but is not awaited before the null check. A missing SHA therefore produces a truthy Promise, bypasses the intended 404, and ultimately returns `200 null`. The browser then reports a contract error instead of a not-found error.
2. **Persisted receipts lose CI duration and slowest-step detail.** `assembleReceipt` only renders those fields from an optional `normalizedRun`, but `getReceipt` never reconstructs or passes that object. Real persisted receipts therefore show `n/a` despite pipeline data having been normalized earlier.
3. **The “candidate error rate regression” alert is not an error rate.** `signoz/alerts/error-rate.json` runs `count()` over every trace matching service/version/environment/route and alerts above five. There is no error-status filter, denominator, or rate calculation. Its annotation admits “absolute floor,” but the name and criterion claim an error rate.
4. **Casting is structurally reproducible but not artifact-immutable.** `casting.yaml` only selects Docker Compose and enables MCP. The lock/generated files resolve multiple images as `latest`. The project’s own SigNoz runbook warns not to start this raw and requires out-of-band digest pins and secrets.
5. **The default local path is broken.** Docker reads the checked-in local `.env`, whose short placeholder admin token fails config validation. After overriding that one value, GitHub and SigNoz remain degraded because their credentials are placeholders.
6. **Readiness is too shallow for the product promise.** `/readyz` and Docker health only require the database. The UI can be “healthy” while both evidence-producing dependencies are broken.
7. **The private LMS is a reproducibility choke point.** Full rehearsal requires a hosted private repository, baseline/bad/recovery SHAs, immutable images, and runtime secret files not available in the public project.
8. **Production dependencies are not currently clean.** The Docker build reports two high-severity vulnerabilities after pruning to production dependencies. Exact packages could not be verified without registry access.
9. **Live integration confidence is low.** Twelve tests are skipped by default: eight PostgreSQL and four SigNoz. No live acceptance artifact was available.
10. **Coverage is informational, not a gate.** Only API coverage is configured and no thresholds prevent regression. The coverage command also failed in this unsupported local Node environment.
11. **The E2E test is too weak.** It accepts either the heading “Changes” or “No changes recorded yet.” It does not validate a real receipt, dependency state, regression/recovery journey, navigation, accessibility, or API data.
12. **Metrics are not a meaningful first-class signal.** An OTLP metrics exporter is configured, but no custom application metric instruments were found. Most product analysis is trace-derived. Logs are strongest in the worker; Fastify request logging is not clearly bridged through the custom OTel log provider.
13. **The documented SigNoz version has a dangerous demo gap.** `signoz/README.md` says the v0.134.0 UI does not render imported v6 dashboard panels. An API read-back is valuable verification, but a blank dashboard page is unacceptable in a judging demo.
14. **Production web configuration is rigid.** The browser API base defaults to `http://127.0.0.1:4000`, and the shipped CSP is tailored to local use. A deployed frontend needs a deliberate runtime/proxy strategy.
15. **The list endpoint performs sequential evaluation reads after parallel pipeline/deployment reads.** The 20-item cap limits impact, but it is still an avoidable latency pattern.

## SigNoz depth assessment

### Where SigNoz is central

GreenLight’s actual decision model depends on SigNoz for:

- exact before/after trace windows;
- `service.name`, `service.version`, environment, and route correlation;
- p90/p95 latency, request count, error evidence, and top slow traces;
- resolvable CI/deployment/AI trace links;
- deployment-impact, pipeline-health, and GreenLight-self dashboards;
- regression alerts;
- MCP-driven investigations;
- trace-correlated structured worker logs.

That is far better than “send spans and show a graph.” It is consistent with SigNoz’s own alerts-first and agent-assisted investigation examples, including the official [Alien Intelligence SRE workflow](https://signoz.io/blog/alien-intelligence-ai-sre-workflow-signoz/).

### Where it is shallow or unproven

- No live SigNoz instance was available during this audit.
- No dashboard panel was visually verified.
- No alert was imported, fired, notified, or resolved.
- No real MCP call was captured and resolved against trace IDs.
- No service map evidence was demonstrated.
- Metrics are exporter-level plumbing rather than a meaningful product signal.
- API-side log export/correlation is less convincing than worker logging.
- Reconstructed GitHub traces are legitimate and honestly labeled, but judges may still see them as generated evidence rather than native telemetry.
- The dashboard compatibility note means the most visible observability surface may be blank.

### Best next SigNoz improvements

1. Pin and start one known-compatible SigNoz release; record the exact digests in the reproducible installation path.
2. Import and visually verify all three dashboards and both alerts against that release.
3. Correct the error-rate query to compute errors divided by total requests, or rename it to an error-count floor and add an explicit error-status filter.
4. Fire and resolve both alerts during rehearsal; show the notification and link it back to a receipt.
5. Add custom counters/histograms for evaluation decisions, dependency failures, queue latency, and evidence-verification outcomes.
6. Bridge API request logs through the OTel logs pipeline and show a query correlating request ID, job ID, trace ID, and commit SHA.
7. Make a genuine MCP comparison query and persist a sanitized transcript containing trace IDs that resolve in the same SigNoz instance.
8. If a service map is shown, ensure the topology is genuinely useful; do not add it merely for a checklist.

## Product and UX audit

### Flow 1: empty change list — unhealthy

![GreenLight empty state](/Users/siddhant/Desktop/hackathon/audit/screenshots/01-empty-changes.png)

The first-run product is only “No changes recorded yet.” There is no name, value proposition, setup status, sync action, sample receipt, dependency health, or explanation of what a change receipt is. A judge opening the app concludes that it is unfinished.

### Flow 2: populated list — functional but visually under-signaled

![GreenLight populated change list](/Users/siddhant/Desktop/hackathon/audit/screenshots/02b-change-list-stable.png)

The card is readable and responsive, but all status badges share the same neutral treatment. A regression is not visually more urgent than a verified AI link. There is no filter, search, overview metric, most-recent incident emphasis, or route to dependency/job health.

### Flow 3: change receipt — technically healthy, narratively dense

![GreenLight change receipt](/Users/siddhant/Desktop/hackathon/audit/screenshots/03-change-receipt.png)

Strengths:

- semantic main/header/section structure;
- explicit evidence states and withheld unverified links;
- a complete AI → CI → deployment → impact → recovery timeline;
- exact hashes, windows, thresholds, and caveat;
- responsive cards;
- the revert command copies successfully and confirms “Copied to clipboard.”

Weaknesses:

- no dominant decision card answering “ship, rollback, or investigate?”;
- no navigation/back link;
- long hashes and digests dominate the reading rhythm;
- the highest-value finding is buried between implementation details;
- no inline dependency freshness or “last verified” timestamp;
- no visible relationship between evidence links and the exact cards they prove.

### Flow 4: mobile receipt — responsive but too tall

![GreenLight mobile receipt](/Users/siddhant/Desktop/hackathon/audit/screenshots/04b-receipt-mobile-viewport.png)

The layout stacks cleanly at 390×844 and long identifiers wrap. The information density becomes exhausting, however. Put the verdict, p95/error deltas, and recovery state first; collapse raw hashes/windows/evidence under progressive disclosure.

### Flow 5: missing receipt — unhealthy

![GreenLight missing receipt](/Users/siddhant/Desktop/hackathon/audit/screenshots/05-missing-receipt.png)

The UI reduces authorization, not-found, contract, network, and degraded-dependency failures to “Receipt unavailable.” The API client already models distinct errors, but the page discards them. There is no retry, back link, request ID, or remediation.

### Accessibility assessment

Positive:

- major populated views use headings, lists, links, a main landmark, status/alert roles, and a labeled timeline;
- text contrast appears adequate on the dark palette;
- long identifiers wrap instead of forcing horizontal scrolling;
- mobile reflow is stable;
- the copy action is a real button with status feedback.

Unverified or missing:

- no automated axe/accessibility checks;
- no documented keyboard-only or screen-reader walkthrough;
- no verified visible focus-state audit;
- empty and error states lack the same landmark structure as the populated view;
- color semantics are absent from the list badges, while evidence states rely on both color and text only inside receipts.

Do not claim WCAG conformance without a real accessibility test pass.

## Security, operational, and compliance risk register

| Severity | Risk | Evidence | Consequence |
|---|---|---|---|
| Critical | Required submission artifacts absent | No project blog or ≤3-minute video link | Cannot complete required form / presentation score collapses |
| Critical | Real SigNoz evidence chain unavailable | SigNoz dependency failed; live tests and MCP verification blocked | Core sponsor-use claim remains unproven |
| Critical | Demo workload not reproducible | Private LMS plus missing SHAs/images/secrets | Judges cannot reproduce signature flow |
| High | Floating Foundry images | `latest` in lock/generated stack; docs require out-of-band digest pins | Non-deterministic or broken judge environment |
| High | Dashboard UI incompatibility | Project documents empty v6 panels on SigNoz v0.134.0 | Most important live visual may be blank |
| High | Production dependency vulnerabilities | Docker prune reports two high vulnerabilities | Security/technical-excellence penalty; CI risk |
| High | Broken missing-receipt HTTP contract | Async result not awaited before 404 check | `200 null`, generic UI failure, incorrect API semantics |
| High | “Error rate” alert counts all spans | `count()` without error predicate or denominator | False alarms and loss of observability credibility |
| High | Placeholder local configuration | Default Docker startup rejected, then dependencies degraded | Poor judge onboarding and unreliable demo |
| Medium | Readiness ignores essential integrations | DB-only readiness while GitHub/SigNoz fail | Green but useless deployment |
| Medium | Twelve live tests skipped | PostgreSQL 8, SigNoz 4 | Hidden integration regressions |
| Medium | No meaningful custom metrics | Exporter configured, no instruments found | Weak multi-signal story |
| Medium | Generic UI failures | Modeled API errors discarded by view | No recovery path or judge confidence |
| Medium | Coverage not gated | No thresholds; API only | Regression risk |
| Low | Sequential evaluation lookups | Loop after list fetch | Avoidable list latency |

## Why this project could win

- The problem is timely, valuable, and easy to state.
- “AI change flight recorder” is a strong, ownable phrase.
- SigNoz is structurally essential to the comparison, not a logo integration.
- The evidence chain joins domains competitors often leave separate: coding agent, Git, CI, deploy, production, recovery.
- The project’s epistemic discipline is excellent: reconstructed spans are labeled, verification is fail-closed, and correlation is not presented as causation.
- The implementation already contains many hard parts: normalized CI topology, persistent evidence, Query Builder v5 requests, recovery incidents, dashboards/alerts, MCP verification logic, and robust tests.
- The receipt is a tangible product artifact, not merely an investigation transcript.

## Why this project could lose

- A judge may see only a blank screen and broken dependencies.
- Mandatory submission artifacts are absent.
- The real workflow depends on private and unconfigured systems.
- There is no verified live SigNoz screenshot, dashboard, alert, MCP transcript, or trace.
- The main alert contains a query/label mismatch that an observability judge can spot instantly.
- “Reconstructed CI traces” may be perceived as synthetic unless the provenance is explained in one sentence and backed by a live GitHub run.
- The repository is optimized for production remediation, not for a three-minute judging experience.
- The demo needs too many terminals and external prerequisites.
- Current docs explicitly deny a completed evidence chain, which is honest but disqualifying if left unresolved.
- High-severity production dependency findings undermine the strong security posture.

## Recommended changes

### Critical blockers

| Priority | Exact change | Why judges care | Likely score impact | Difficulty | Risk | Dependencies | Demo effect |
|---|---|---|---:|---|---|---|---|
| P0 | Produce one real baseline → bad candidate → recovery run; verify every AI/CI/deployment/evaluation/MCP trace ID in the same live SigNoz and save a signed evidence manifest | Converts the central claim from architecture to proof | +10–15 | High | Live rehearsal may fail late | Public workload, GitHub, SigNoz, credentials, images | Becomes the whole demo |
| P0 | Publish the required new SigNoz implementation blog and a ≤3-minute YouTube demo; complete a dry run of every form field | Required for submission and presentation | +8–12 / avoids rejection | Medium | Last-minute upload/form issues | Final evidence and screenshots | Gives judges an asynchronous fallback |
| P0 | Replace the private LMS dependency with a public minimal demo workload or include a reproducible public harness and immutable baseline/bad/recovery artifacts | Judges must reproduce the signature value | +4–7 | Medium–High | May diverge from current scripts | Container registry/public repo | Makes one-command rehearsal possible |
| P0 | Pin a known-compatible SigNoz/collector/MCP set by digest in the actual casting/lock path; run `gauge`, `forge`, fresh `cast`, smoke, imports, and MCP verification from a clean environment | Official rules emphasize Foundry/MCP; reproducibility is judged | +4–6 | High | Version/schema mismatch | Registry digests, secrets | Prevents a blank/broken observability segment |
| P0 | Make the checked-in demo bootstrap fail with one actionable message or succeed with a documented `.env.demo.example`; remove stale local placeholders from the judging path | First-run quality determines screening | +3–5 | Low–Medium | Accidental secret inclusion | Public workload and local SigNoz | Avoids setup failure on camera |
| P0 | Resolve production high-severity dependency findings and rerun audit/SBOM/Trivy gates | Technical/security judges will ask | +2–4 | Medium | Dependency upgrades can break APIs | Registry access | Can be shown as a clean CI gate |
| P0 | Fix missing-receipt `await`, preserve normalized CI duration/slowest step, and add regression tests | Removes concrete correctness defects in the hero artifact | +2–3 | Low | Low | None | Avoids embarrassing `200 null` and `n/a` |
| P0 | Correct and live-test the error-rate alert; show fire and resolve with a real notification channel | Demonstrates accurate, consequential SigNoz use | +3–5 | Medium | Query schema/version differences | Live SigNoz and channel | Creates a compelling incident trigger |
| P0 | Resolve the v0.134 dashboard rendering gap by selecting a compatible release/schema or creating verified UI-native dashboards; record all IDs/screenshots | Dashboards must be visible to count in a demo | +4–6 | Medium–High | Upstream incompatibility | Live SigNoz | Replaces API-only proof with a visual moment |
| P0 | Create a judge landing state with project promise, dependency readiness, a “view verified demo receipt” route, and an explicit “run/sync” next action | Prevents blank-screen failure | +4–6 | Medium | Seed/demo state must never be confused with real proof | Reliable API status | Makes the product legible in ten seconds |

### SigNoz and observability depth

| Priority | Exact change | Why judges care | Likely score impact | Difficulty | Risk | Dependencies | Demo effect |
|---|---|---|---:|---|---|---|---|
| P1 | Add custom metrics for evaluation verdicts, evidence-verification failures, queue wait/runtime, and dependency state | Makes “metrics” a meaningful signal rather than exporter plumbing | +2–3 | Medium | Cardinality mistakes | OTel metric design | Adds a credible self-observability panel |
| P1 | Export and query API logs with trace ID, request ID, job ID, repository, commit SHA, and redacted error class | Deepens logs/traces correlation | +2 | Medium | Sensitive/high-cardinality fields | Logger bridge | Enables one strong cross-signal drill-down |
| P1 | Persist a sanitized, genuine MCP transcript and display its source trace IDs in the receipt | Makes the agent-native differentiator visible | +3–4 | Medium | Transcript may leak secrets | MCP service account/redaction | Provides a 15-second “ask SigNoz” moment |
| P1 | Link SigNoz alert notifications to the GreenLight incident/evaluation flow | Turns alerts into product behavior | +2–4 | Medium–High | Duplicate/replayed webhooks | Alert channel receiver | Makes SigNoz causally important to workflow |
| P2 | Add a useful service-map segment only if it reflects real GreenLight/API/worker/workload topology | Can demonstrate cross-service context | +1 | Medium | Cosmetic checklist integration | Multi-service instrumentation | Optional screenshot, not core |

### Product and UX polish

| Priority | Exact change | Why judges care | Likely score impact | Difficulty | Risk | Dependencies | Demo effect |
|---|---|---|---:|---|---|---|---|
| P1 | Put a large verdict card first: “Regressed — rollback recommended,” with p95/error deltas, confidence/evidence state, and recovery status | Answers the product question instantly | +3–5 | Low–Medium | Avoid implying causation | Existing receipt data | Strong opening product shot |
| P1 | Add persistent brand/nav, back link, dependency status, last verification time, and evidence freshness | Makes app navigable and trustworthy | +2–3 | Low | Status noise | Status endpoint | Judges can recover from any screen |
| P1 | Give badge colors/icons semantic meaning and sort/filter by regression/evidence state | Improves scanability | +1–2 | Low | Color accessibility | Design tokens | Highlights the bad deploy instantly |
| P1 | Render specific not-found/auth/degraded/contract errors with retry, back link, request ID, and setup help | Shows failure maturity | +1–2 | Low | Overexposing internals | Existing `ApiError` model | Prevents dead-end demo states |
| P1 | Collapse hashes, windows, policies, and raw evidence under “technical details” on small screens | Keeps the narrative dominant | +1–2 | Low | Hiding evidence too deeply | None | Mobile receipt becomes presentable |
| P2 | Add axe, keyboard, focus, and mobile viewport checks to CI | Supports accessibility claims | +1 | Low–Medium | Test maintenance | Browser CI | A credible quality statement |

### Demo and presentation

| Priority | Exact change | Why judges care | Likely score impact | Difficulty | Risk | Dependencies | Demo effect |
|---|---|---|---:|---|---|---|---|
| P0 | Rehearse a deterministic three-minute script with real pre-generated telemetry; do not wait for CI/load/alerts live | Time discipline and reliability | +4–6 | Medium | Timestamps can become stale | Complete evidence run | Eliminates dead air |
| P0 | Record a local high-quality backup video and keep screenshots of every external dependency state | Live demos fail | +2–3 | Low | Evidence may look prerecorded | Completed rehearsal | Instant fallback |
| P1 | Create one architecture diagram with six nodes and one sentence per transition | Judges need the chain, not repository topology | +2 | Low | Diagram clutter | None | 15-second technical explanation |
| P1 | Put a verified proof table near the top of README: requirement, status, live URL/trace ID, last verified | Makes repository judging efficient | +2–3 | Low | Stale status | Final rehearsal | Lets judges validate claims quickly |
| P1 | Rewrite README opening as problem → demo → SigNoz necessity → quickstart, moving remediation detail lower | Presentation quality | +2–3 | Low | None | Final evidence links | Improves asynchronous judging |

### Optional enhancements

| Priority | Exact change | Why judges care | Likely score impact | Difficulty | Risk | Dependencies | Demo effect |
|---|---|---|---:|---|---|---|---|
| P2 | Post the verified receipt as a GitHub Check/PR comment | Brings value into developer workflow | +1–3 | Medium | External-write permissions | GitHub App/token | Nice closing shot |
| P2 | Add an explicit risk score based on evidence completeness, not an opaque AI score | Improves prioritization without overclaiming | +1 | Medium | False precision | Policy design | Useful list sorting |
| P2 | Support a second public workload adapter | Demonstrates generality | +1 | High | Scope creep | Stable core workflow | Better future roadmap than demo |

## Strongest narrative

> AI can ship a change that passes CI and still hurts production. GreenLight gives every AI-authored change a black-box flight recorder: verified AI origin, CI trace, immutable deploy marker, SigNoz before/after evidence, and proof of recovery—one receipt, without pretending correlation is causation.

The villain is not “bad AI.” It is fragmented evidence. The hero is not a generic agent. It is the receipt, powered by SigNoz as the system that can interrogate the exact deployed version across traces, logs, metrics, dashboards, alerts, and MCP.

## Three-minute demo script

**0:00–0:18 — Hook**  
“This change was written by an AI agent. CI is green. Production is not.” Show the pull request/commit and one slow request result.

**0:18–0:35 — Promise**  
Show the architecture diagram. Say: “GreenLight joins the AI trace, Git commit, GitHub Actions trace, immutable deploy, SigNoz telemetry, and recovery into one auditable receipt.”

**0:35–0:58 — Provenance and CI in SigNoz**  
Open the verified AI parent span and the reconstructed CI waterfall. Explicitly say reconstructed GitHub spans are labeled as reconstructed because GitHub does not emit them natively.

**0:58–1:25 — Candidate impact in SigNoz**  
Show the deployment marker and the dashboard filtered to the bad `service.version`, environment, and route. Highlight request count, p90/p95, error rate, and one slow trace. Show the alert firing.

**1:25–1:58 — GreenLight receipt**  
Open the receipt’s dominant “Regressed” verdict. Show exact baseline/candidate windows, evidence links, and the caveat that this is version/time correlation, not causal proof.

**1:58–2:20 — MCP investigation**  
Ask one prepared question: “Compare checkout latency and errors before and after version X; give the top trace IDs.” Show that returned IDs open in SigNoz.

**2:20–2:43 — Recovery**  
Show the recovery deployment, resolved alert, and recovered receipt. Copy the human-reviewed revert command if relevant; do not claim automatic rollback.

**2:43–3:00 — Close**  
“SigNoz is not the dashboard after the fact. It is the evidence engine that lets GreenLight prove what changed, what production observed, and whether recovery worked.”

Use real pre-generated telemetry and fixed windows. Do not fake data, wait for a fresh CI run, or depend on a live external network during the judged recording.

## Screenshots and artifacts the final submission must show

1. The one-page architecture diagram.
2. A real GreenLight receipt with verified AI/CI/deploy/SigNoz evidence.
3. The AI parent trace in SigNoz.
4. The reconstructed GitHub Actions waterfall, visibly labeled reconstructed.
5. The deployment marker trace with immutable `service.version`.
6. The Deployment Impact dashboard filtered to exact baseline and candidate windows.
7. A top slow trace opened from the candidate window.
8. Worker/API logs filtered by commit/job ID and correlated to the trace.
9. The error-rate and p95 alerts firing, notification delivered, and recovery resolved.
10. The GreenLight self-observability dashboard.
11. The genuine MCP question/response with trace IDs opened in SigNoz.
12. A clean CI gate showing unit/integration/browser/security/image jobs.
13. A fresh Foundry cast/smoke result with pinned versions.
14. A mobile receipt view.
15. A failure/degraded state that explains remediation rather than hiding it.

Only show a service map if it adds real topology insight.

## Submission package blueprint

### Project title

**GreenLight — AI Change Flight Recorder**

### One-line description

GreenLight turns every AI-authored deployment into an auditable receipt linking agent provenance, CI, immutable release identity, SigNoz production evidence, and verified recovery.

### Short description

AI-generated code can pass CI and still regress production. GreenLight connects an AI coding trace to the Git commit it produced, reconstructs the corresponding GitHub Actions run as explicitly labeled telemetry, records the immutable deployed version, compares exact before/after windows in SigNoz, and stores a change receipt with evidence links and recovery proof. SigNoz supplies the correlated traces, logs, metrics, dashboards, alerts, Query Builder analysis, and MCP investigation that make the receipt verifiable.

### README order

1. Hero: problem, one-line answer, 20-second GIF/video.
2. Verified demo links and proof-status table.
3. Why SigNoz is essential.
4. Architecture diagram.
5. Five-minute clean-clone quickstart.
6. Three-minute demo flow.
7. Evidence and screenshots.
8. Technical design and reconstruction disclosure.
9. Security/privacy and causality limits.
10. Testing/reproducibility.
11. AI-assistance/provenance disclosure.
12. Known limitations and roadmap.

### Blog outline

1. The gap between green CI and healthy production.
2. Why AI-authored changes need a flight recorder.
3. Evidence model and trust boundaries.
4. Instrumentation: AI traceparent, Git, reconstructed CI, deployment marker.
5. Exact version/window queries with Query Builder v5.
6. Dashboards, logs, metrics, and alert design.
7. MCP investigation and trace-ID verification.
8. Recovery proof and causal caveat.
9. Failure modes, privacy, and lessons learned.
10. Reproduce it with Foundry.

### Required form preparation

- Team and submitter names.
- Track 3 selected.
- Final public repository URL with casting files.
- Final description above.
- ≤3-minute YouTube URL.
- Detailed SigNoz use answer with live evidence links.
- New detailed project-blog URL.
- Hackathon-experience answer.
- Optional deployed app URL only if it is reliable.

## Adversarial judge questions and strong answers

**“Are these fake traces?”**  
“The AI, application, deployment, and GreenLight runtime spans are real OTLP telemetry. GitHub does not emit native OTel spans, so we deterministically reconstruct its run/job/step topology from the GitHub API, label every span `origin=reconstructed`, and link—not parent—it to the AI context. Every link shown as verified resolves in the live SigNoz instance.”

**“Does GreenLight prove the commit caused the regression?”**  
“No. It proves temporal and deployed-version association over exact persisted windows. The receipt says that explicitly. It gives a human the evidence to decide; it does not turn correlation into causal certainty.”

**“Why is SigNoz necessary?”**  
“Without SigNoz there is no common evidence layer across deployment markers, version-filtered traces, latency/error comparisons, correlated logs, alerts, dashboards, and MCP. GreenLight stores the audit decision, but SigNoz supplies and resolves the production evidence behind it.”

**“Why reconstruct CI instead of using GitHub’s UI?”**  
“The reconstruction makes CI duration and failure topology queryable next to runtime traces and the deployed version. It is honest about origin, reproducible from the GitHub API, and linked to the original run.”

**“How do you prevent hallucinated evidence?”**  
“Evidence is fail-closed. A link is withheld until the authoritative integration resolves it. The MCP verifier rejects results whose cited trace IDs cannot be found in SigNoz.”

**“What sensitive AI data do you collect?”**  
“The link uses trace/span context and selected safe metadata—not prompts or tool content. Logs are structured and redacted, and secrets are never compiled into the browser.”

**“Why not auto-rollback?”**  
“The current product provides evidence and a copyable, human-reviewed revert action. Automated rollback would require stronger policy, approval, blast-radius, and deployment-integrity controls, so we do not overclaim it.”

**“Can this scale beyond the demo?”**  
“The queue, idempotency, typed contracts, and PostgreSQL adapter are designed for that direction, but we only call production-ready after live PostgreSQL, backup/restore, security, and load gates pass. Today’s honest claim is a validated hackathon system, not a finished enterprise control plane.”

**“Why is the monitored app private?”**  
“That is a current reproducibility defect. The submission should replace it with a public minimal workload and immutable artifacts before judging.”

**“How are baseline and candidate windows selected?”**  
“They are persisted with the exact service version, environment, route, start/end times, sample counts, thresholds, and policy version. A receipt can therefore be audited later rather than recomputed under changed defaults.”

**“What happens when SigNoz is unavailable?”**  
“The system must show dependency degradation and refuse to mark evidence verified; it does not treat no telemetry as a clean deployment. The current UI needs to surface that state more clearly.”

## Top 10 highest-leverage actions

1. Complete and record one genuine baseline → regression → recovery evidence chain in live SigNoz.
2. Publish the mandatory new SigNoz blog and ≤3-minute YouTube demo; dry-run the full form.
3. Make the workload public and reproducible with immutable baseline/bad/recovery artifacts.
4. Pin and clean-cast a known-compatible SigNoz/collector/MCP stack; make dashboards visibly render.
5. Fix the error-rate alert and show it firing and resolving.
6. Replace the blank first-run UI with a judge landing state and verified demo receipt.
7. Fix the async 404 and missing CI duration/slowest-step receipt defects.
8. Eliminate the two high-severity production dependency findings and show a green security gate.
9. Capture a genuine MCP comparison whose cited traces open in SigNoz.
10. Rehearse the three-minute narrative with zero live waiting and a recorded fallback.

## Final readiness checklist

### Submission compliance

- [x] Intended single track selected: Track 3.
- [x] `casting.yaml` and `casting.yaml.lock` exist.
- [x] AI assistance disclosed.
- [x] Project history begins after hackathon start.
- [x] License present.
- [ ] Mandatory new SigNoz project blog published.
- [ ] Mandatory ≤3-minute YouTube demo published.
- [ ] Full form dry-run completed.
- [ ] Public repository/workload reproducible by judges.

### Technical proof

- [x] Lint, typecheck, build, and core tests pass.
- [x] Foundry gauge and forge pass.
- [ ] Clean Foundry cast with pinned image digests passes.
- [ ] SigNoz smoke and backdated-span smoke pass.
- [ ] Live PostgreSQL integration and restore checks pass.
- [ ] Live SigNoz integration tests pass.
- [ ] All dashboards import, render, and have recorded IDs.
- [ ] Alerts import, fire, notify, and resolve.
- [ ] Genuine MCP result verifies live trace IDs.
- [ ] Production dependency audit/Trivy gates are clean.
- [ ] Full acceptance passes from a clean environment.

### Product/demo

- [ ] First-run screen explains the product and next action.
- [ ] One verified receipt is available without manual seeding.
- [ ] Verdict is visually dominant.
- [ ] Specific error/degraded states are actionable.
- [ ] Desktop and mobile flows pass.
- [ ] Keyboard/focus/axe checks pass.
- [ ] Demo completes in under 2:50 during three consecutive rehearsals.
- [ ] Backup recording and screenshot deck are available offline.

### Claims discipline

- [x] Reconstructed telemetry is labeled.
- [x] Correlation is not claimed as causation.
- [x] Unverified links are withheld.
- [x] AI assistance and pre-existing workload are disclosed.
- [ ] Every final screenshot and claim maps to live, resolvable evidence.
- [ ] Synthetic fixtures are visibly separated from submission proof.

## Bottom line

GreenLight is not “just another AI SRE agent.” Its best idea is an auditable change receipt that treats SigNoz as the cross-system evidence engine for AI-authored software delivery. That idea is credible and competitive.

Today, however, the project asks judges to infer a finished product from excellent scaffolding, careful documentation, and synthetic fixtures. Hackathons reward what can be understood and believed in minutes. Convert the architecture into one real, reproducible, visually undeniable incident-and-recovery chain; package it in the mandatory video and blog; and make the first screen tell the story. Do that, and GreenLight can plausibly contend for Track 3. Submit the current state, and the most likely outcome is admiration for the engineering followed by elimination for missing proof and presentation.
