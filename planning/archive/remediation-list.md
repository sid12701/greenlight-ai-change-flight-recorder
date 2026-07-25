# GreenLight Consolidated Remediation List

**Project:** GreenLight — AI Change Flight Recorder  
**Audited commit:** `95935e3d343146efb03a9e601263526440de2a29`  
**Status:** Not production-ready and not yet a reproducible end-to-end demo  
**Purpose:** Canonical, deduplicated remediation plan derived from two independent audits and their reconciliation

> Implementation status, validation evidence, rollback notes, external blockers,
> and the final production-readiness decision are maintained in
> [`docs/REMEDIATION_TRACKER.md`](docs/REMEDIATION_TRACKER.md). Checkboxes in
> this canonical audit remain open until the tracker records full repository and
> live acceptance as `complete`.

## 1. Final consensus

GreenLight has a sound product concept and several well-designed pure modules, especially its traceparent parser and basic regression evaluator. The integrated evidence chain is not currently trustworthy.

The intended chain is:

```text
Claude Code trace
  → commit AI-Traceparent trailer
  → GitHub Actions workflow/job/step trace
  → versioned LMS deployment
  → exact-window SigNoz telemetry evaluation
  → regression receipt
  → recovery proof
  → SigNoz MCP investigation
```

The running implementation does not yet produce this chain:

- The live database contains no pipeline runs.
- Existing change rows were fabricated by a GitHub error fallback.
- Reconstructed CI spans are kept in memory and never exported to SigNoz.
- The documented Claude trace is a synthetic OTLP smoke-test trace.
- Evaluation windows can precede the deployments they claim to measure.
- Recovery does not reuse an immutable baseline window.
- Deployment version visibility is stubbed to always succeed.
- SigNoz failures silently fall back to direct ClickHouse access and may change the requested time window.
- The receipt associates candidate and recovery deployments incorrectly.
- The MCP fixture does not contact the SigNoz MCP server.
- The compiled API cannot start.
- A clean clone cannot pass the current CI command.
- The LMS dependency is not green or independently reproducible.
- No complete production deployment, security, backup, or rollback architecture exists.

### 1.1 Delivery tracks and the sequencing constraint

`GREENLIGHT_IMPLEMENTATION_PLAN.md` sets the implementation window at **July 23–26, 2026**. This audit is dated **July 24**. The merge plan in §5 is a three-to-four week production programme and cannot be completed inside that window.

The plan is therefore split into two tracks. Both are real work; only one is bounded by the submission.

**Track A — evidence truthfulness.** The smallest set that prevents GreenLight from reporting evidence it cannot verify:

| Merge | Why it is on Track A |
|---|---|
| 00 | Documentation currently asserts a chain the system cannot produce |
| 01 | Nothing downstream is verifiable until a clean checkout builds and starts |
| 02 + 04 — one atomic release | Delete fabricated GitHub changes, window widening and null-to-zero coercion while replacing the unsupported SigNoz fallback with the supported query path. Neither merge may be deployed without the other |
| 07 | The reconstructed CI trace is the differentiator and has never been exported |
| 08 — required for the full headline claim | Verify a real Claude trace and exact parent span. A disclosed session-ID fallback may support a degraded demo, but it does not prove the full Claude→commit→CI chain |
| 10 | Verdicts are computed over windows that can predate their own deployment |
| 11 | The receipt mis-associates candidate and recovery |

**Track B — production readiness.** The remainder of Merge 02 (full schema validation, authorization, rate limiting), plus Merges 03, 05, 06, 09, 12, 13, 15 and 16. All are correct and should be executed. None of them make the demo truthful, and none should gate a submission.

**Merge 08 sits on the submission boundary.** A verified Claude trace is required for the full headline claim, but it depends on Claude Code beta tracing and `TRACEPARENT` propagation, which the implementation plan flags as pivot-gated. A disclosed session-ID fallback may be used for a degraded demo, but the README, receipt, judging narrative and Track 3 evidence must then state that the Claude trace leg is unverified. The fallback does not satisfy the final production acceptance gate.

**Ordering rule:** do not begin Track B merges that rebuild persistence or ingestion (03, 05, 06) before Track A has proved the evidence chain end to end. Rebuilding the layers that currently work, ahead of the leg that is broken, is the principal sequencing risk in this plan.

## 2. Non-negotiable engineering principles

### 2.1 Fail closed

GreenLight is an evidence product. Missing or unverifiable evidence must never be converted into plausible evidence.

The following behaviors are prohibited:

- Fabricating change metadata after a GitHub failure
- Substituting ClickHouse for a failed SigNoz API request
- Widening a query window to obtain more spans
- Coercing missing metrics to zero
- Marking a deployment ready without observing its version
- Persisting or rendering a trace as verified before confirming that it exists
- Continuing after a failed Git checkout while labeling the workload with the requested SHA

### 2.2 SigNoz is the telemetry system of record

SigNoz must be authoritative for:

- Claude Code telemetry
- Reconstructed CI telemetry
- Deployment version visibility
- Baseline metrics
- Candidate metrics
- Recovery metrics
- Slow-trace evidence
- Dashboard evidence
- MCP investigation
- GreenLight API and worker observability

PostgreSQL stores metadata, state transitions, thresholds, decisions, and references to verified evidence. It must not replace SigNoz as the source of telemetry.

If SigNoz cannot verify evidence, GreenLight must return `integration_error`, `insufficient_data`, or `unverified`. It must not produce a healthy or regressed verdict.

### 2.3 Use supported interfaces only

The API and worker must not:

- Mount the Docker socket
- Execute `docker exec`
- Query SigNoz internal ClickHouse tables
- Depend on SigNoz container names
- Depend on undocumented storage schemas

Direct ClickHouse inspection may exist only as a separate offline diagnostic tool. Diagnostic output must never populate production evaluations or receipts.

### 2.4 Persist causal state

Do not reconstruct evidence relationships from list ordering or `Date.now()`.

Persist:

- Exact AI trace verification state
- Exact CI export and verification state
- Deployment identity and image digest
- Immutable baseline snapshots
- Exact observed and recovery windows
- The thresholds used
- Regression incidents
- Recovery-to-incident relationships
- Evidence verification state

### 2.5 Deploy immutable artifacts

Production deployments must use pre-tested, signed images identified by digest and full Git SHA.

Production hosts must not:

- Check out source code
- Build with Maven
- Change file permissions
- Kill arbitrary port owners
- Label a running process with an unverified SHA

### 2.6 Integration code is reviewed like module code

Four of the release blockers in §3 concern wiring rather than logic — the ClickHouse fallback (R-10, R-11), the twenty-minute window widening (R-12), the wall-clock evaluation windows (R-07, R-09), and the fabricated GitHub change rows (R-03). All four were introduced in a single commit, `ccdba74`, pushed directly to `main` with no pull request, after all thirty planning issues had been closed.

The per-issue PR process produced the modules that are correct and tested. The code connecting those modules bypassed the process entirely, and that is where every release blocker lives. The register above treats the symptoms; this principle addresses the mechanism.

Required controls:

- Protect `main`. No direct pushes.
- Integration, orchestration, wiring, and script changes require the same review and test evidence as module changes.
- Any change touching an exporter, a query adapter, a time window, or an error-handling path ships with a seam test.
- Issue closure does not demonstrate integrated behaviour. Only the §6 acceptance gate does.

## 3. Consolidated defect register

### Critical — release blockers

- [ ] **R-01: CI spans are never exported.** Replace the in-memory-only CI trace provider with configured OTLP export.
- [ ] **R-02: CI trace IDs are persisted before verification.** Add `pending`, `verified`, and `failed` export states. Render links only when verified.
- [ ] **R-03: GitHub failures fabricate change rows.** Remove the catch-all fallback and return a typed dependency error.
- [ ] **R-04: The live GitHub integration has never populated `pipeline_runs`.** Correct repository/workflow configuration and use a hosted LMS remote with real Actions runs.
- [ ] **R-05: The documented AI trace is synthetic.** Correct the evidence log and capture a real Claude Code trace.
- [ ] **R-06: The documented AI parent span does not exist.** Verify the exact trace and span ID before marking the commit linked.
- [ ] **R-07: Evaluation windows are based on wall clock time.** Persist exact windows anchored to verified deployment readiness.
- [ ] **R-08: Recovery recomputes the baseline.** Introduce an immutable baseline snapshot and reuse it by ID.
- [ ] **R-09: Observed windows can start before deployment.** Reject evaluation until the persisted observed window has elapsed.
- [ ] **R-10: SigNoz authentication failures silently fall back to ClickHouse.** Remove the fallback from the application.
- [ ] **R-11: ClickHouse query values are interpolated.** Remove the application query path entirely; validate all remaining SigNoz filters.
- [ ] **R-12: Query windows silently widen to 20 minutes.** Delete this behavior.
- [ ] **R-13: The sample threshold is hardcoded.** Use the persisted evaluation configuration and never bypass the minimum.
- [ ] **R-14: Deployment version visibility always returns true.** Poll SigNoz for the exact service, version, environment, and route.
- [ ] **R-15: The clean build depends on stale shared-package output.** Implement deterministic workspace build ordering or TypeScript project references.
- [ ] **R-16: CI uses Node 20 with `node:sqlite`.** Standardize on Node 24 LTS, or at minimum Node 22.13+.
- [ ] **R-17: The compiled API cannot find migrations.** Package migrations in the artifact and add a compiled-start test.
- [ ] **R-18: The API lacks a production `start` script.** Add and validate `node dist/server.js`.
- [ ] **R-19: The browser is blocked by CORS.** Use a validated, configurable origin allowlist and make E2E blocking.
- [ ] **R-20: The receipt misidentifies candidate and recovery deployments.** Model a regression incident and explicit recovery relationship.
- [ ] **R-21: Deployment and recovery versions can use the wrong change SHA.** Resolve versions through the deployment's own linked change and image.
- [ ] **R-22: Missing metrics can become zero.** Required null metrics must produce `integration_error` or `insufficient_data`.
- [ ] **R-23: There are no production application artifacts.** Add API, worker, and Web images.
- [ ] **R-24: There is no production deployment or rollback path.** Add staging, canary/blue-green rollout, verified promotion, and rollback.
- [ ] **R-25: SigNoz lacks required JWT security and uses default credentials.** Configure secrets and rotate credentials before exposure.
- [ ] **R-26: SigNoz and OTLP ports are broadly exposed.** Restrict them to private networks or loopback in local environments.
- [ ] **R-27: Floating `latest` images prevent reproducibility.** Pin every runtime image by immutable version or digest.
- [ ] **R-28: The LMS dependency is not green.** Fix the 22 test-isolation errors and require a green suite before image publication.
- [ ] **R-29: The LMS clone is detached, dirty, and local-only.** Create a clean hosted demo repository/branch with stable regression and recovery refs.
- [ ] **R-30: The LMS deploy script can run the wrong code under the requested SHA.** Replace mutable checkout deployment with immutable images.

### High — required before production

- [ ] **R-31: No request validation.** Apply Zod schemas to all bodies, parameters, headers, SHAs, routes, repositories, timestamps, and run IDs.
- [ ] **R-32: Read and mutation authorization is inadequate for production.** Introduce OIDC/RBAC or scoped API keys.
- [ ] **R-33: Static token comparison is not constant-time.** Remove static tokens from production; use safe comparison in local fallback mode.
- [ ] **R-34: Health reports hardcoded success.** Implement separate liveness, readiness, and dependency-status endpoints.
- [ ] **R-35: GreenLight does not emit real API spans.** Add Fastify/HTTP OpenTelemetry instrumentation.
- [ ] **R-36: LMS spans are mislabeled as `greenlight-api`.** Isolate environment variables and explicitly set per-process service resources.
- [ ] **R-37: p90 is reported as p95.** Query it correctly or remove it from the API and UI.
- [ ] **R-38: Receipts report default thresholds, not applied thresholds.** Persist and render exact thresholds per evaluation.
- [ ] **R-39: The MCP investigation never contacts MCP.** Use an official MCP client and verify non-null results.
- [ ] **R-40: The MCP fixture uses the wrong version and vacuous validation.** Require the candidate SHA, exact route, non-null metrics, and three resolvable traces.
- [ ] **R-41: Dashboard and alert assets are missing.** Create, import, and verify deployment-impact, pipeline-health, and regression alert assets.
- [ ] **R-42: Stored dashboard links are guessed and dead.** Store configured dashboard identifiers and verify generated URLs.
- [ ] **R-43: GitHub pagination is incomplete.** Follow pagination for workflow runs, jobs, steps, and related APIs.
- [ ] **R-44: Primary workflow selection can guess.** Fail on zero or multiple matches unless an explicit workflow ID resolves ambiguity.
- [ ] **R-45: Secondary workflow runs do not receive traces.** Emit one trace per workflow run and link AI context only to the primary.
- [ ] **R-46: GitHub retry behavior lacks backoff.** Add bounded exponential backoff, jitter, timeout, and `Retry-After` support.
- [ ] **R-47: Deployment recording is not idempotent.** Use provider/idempotency keys and safe upserts.
- [ ] **R-48: Multi-row writes are not transactional.** Make synchronization, evaluation, evidence, and incident writes atomic.
- [ ] **R-49: SQLite is unsuitable as the main production store.** Move production metadata to PostgreSQL.
- [ ] **R-50: No structured operational logging.** Add JSON logs, request IDs, typed errors, and secret redaction.
- [ ] **R-51: No graceful shutdown.** Drain requests, flush telemetry, stop workers, and close the database on termination.
- [ ] **R-52: No rate or request limits.** Add body-size, timeout, concurrency, and rate-limit policies.
- [ ] **R-53: E2E is non-blocking.** Remove `continue-on-error` and protect the main branch with required checks.
- [ ] **R-54: Integration test coverage is missing.** Add API, database, SigNoz, OTLP, GitHub, recovery, browser, and artifact tests.
- [ ] **R-55: No lint, formatting, shell, coverage, security, or image gates.** Add them to CI.
- [ ] **R-56: No backup and restore process.** Implement and rehearse PostgreSQL and SigNoz persistence recovery.
- [ ] **R-57: No production secrets management.** Use the deployment platform's secret manager; never bake secrets into images.
- [ ] **R-74: The LMS health-check URL is hardcoded.** `apps/api/src/modules/deployments/service.ts:44` probes `http://127.0.0.1:8081/actuator/health` regardless of configuration, so deployment recording only works for one host, port, and service. Derive the probe target from the deployment record.
- [ ] **R-75: Deployment spans are never emitted.** `emitted_trace_id` is always persisted as `null`, and the `deployment.started` / `deployment.succeeded` spans required by the implementation plan are never produced. SigNoz therefore has no deployment markers to correlate telemetry against, which the Deployment Impact dashboard depends on.

### Medium — required for a durable, maintainable system

- [ ] **R-58: Route/business orchestration lives in `server.ts`.** Move evaluation, synchronization, and receipt orchestration into domain services.
- [ ] **R-59: `changeShaForDeployment` scans a capped list.** Add a direct indexed lookup.
- [ ] **R-60: Recovery baseline resolution ignores service and environment.** Resolve through the incident's immutable baseline snapshot.
- [ ] **R-61: Evidence ordering relies on timestamps.** Persist an explicit type/ordinal and use a stable secondary key.
- [ ] **R-62: Receipt evidence and thresholds are not fully rendered.** Implement all specified UI states and links.
- [ ] **R-63: UI metrics are unformatted.** Apply consistent units, precision, and accessible labels.
- [ ] **R-64: UI lacks runtime response validation.** Parse API responses before rendering them.
- [ ] **R-65: The load generator aborts on non-2xx.** Count errors and continue so controlled error-rate regressions can be tested.
- [ ] **R-66: The load generator ignores `--requests`.** Implement documented CLI parsing and publish achieved request counts.
- [ ] **R-67: Test databases can write into the workspace.** Use temporary isolated databases or ephemeral PostgreSQL.
- [ ] **R-68: Git-hook tests inherit global signing configuration.** Isolate Git configuration in the test harness.
- [ ] **R-69: Invalid GitHub timestamps can become `NaN`.** Reject malformed timestamps explicitly.
- [ ] **R-70: Dead or unsafe timestamp helpers remain.** Remove them or use OpenTelemetry-supported `HrTime`.
- [ ] **R-71: Reset documentation and behavior disagree.** Implement a separately authorized full rebuild tool or remove the documented hard mode.
- [ ] **R-72: Host prerequisites are undocumented.** Prefer containers; preflight-check any remaining requirements.
- [ ] **R-73: Container resource limits and dependency health conditions are absent.** Add explicit limits and readiness ordering.

### Low — hygiene and documentation

- [ ] Remove committed demo credential defaults.
- [ ] Correct `.env.example` to reference the monitored LMS repository.
- [ ] Remove dead production helpers or make one implementation authoritative.
- [ ] Correct stale README, tracker, and evidence claims.
- [ ] Add formatting for long metric values.
- [ ] Record limitations and verification evidence in every future issue/PR.

## 4. Production target architecture

```text
Claude Code
  └─ OTLP → OTel Collector → SigNoz

GitHub
  └─ signed webhook → GreenLight API
                         ├─ PostgreSQL metadata/state
                         └─ transactional job/outbox

GreenLight worker
  ├─ fetch paginated GitHub workflow/job/step data
  ├─ emit reconstructed CI spans through OTLP
  ├─ verify traces through SigNoz
  ├─ verify deployed service.version
  ├─ evaluate immutable telemetry windows
  └─ assemble verified evidence

Deployment platform
  └─ authenticated deployment event → GreenLight API

LMS immutable image
  └─ OTLP with service.version=<full SHA> → OTel Collector → SigNoz

GreenLight Web
  └─ authenticated reads → GreenLight API
```

### API responsibilities

- Authentication and authorization
- Request validation
- GitHub webhook ingestion
- Deployment event ingestion
- Idempotent state creation
- Read APIs
- Liveness/readiness/dependency status

The API must not perform long-running GitHub synchronization or evaluation inside HTTP handlers.

### Worker responsibilities

- GitHub synchronization
- CI span synthesis and export
- Export verification
- Deployment version verification
- Baseline capture
- Candidate and recovery evaluation
- Evidence verification
- Retry and backoff

Use PostgreSQL-backed transactional jobs/outbox initially to avoid introducing a separate queue without need.

### Proposed persistence model

- `repositories`
- `changes`
- `ai_trace_contexts`
- `pipeline_runs`
- `pipeline_export_attempts`
- `deployments`
- `baseline_snapshots`
- `evaluation_windows`
- `evaluations`
- `regression_incidents`
- `recovery_evaluations`
- `evidence_links`
- `jobs`
- `audit_events`

Required state machines:

```text
AI trace:        missing | invalid | unverified | verified
Pipeline export: pending | exported | verified | failed
Deployment:      pending | ready | version_verified | failed
Evaluation:      pending | healthy | regressed | insufficient_data | integration_error
Incident:        open | recovery_pending | recovered | unresolved
Evidence:        pending | verified | failed
```

## 5. Ordered merge plan

Each merge must be independently reviewable and must satisfy its acceptance criteria before the next dependent merge begins. Merge numbering is stable; §1.1 defines which merges belong to the time-boxed evidence-truthfulness track and which are production-track work.

### Merge 00 — Truth reset and characterization tests

- Correct README, tracker, and evidence log claims.
- Mark AI, CI, MCP, recovery, and self-observability evidence unverified.
- Add tests that reproduce every critical failure.
- Withdraw the Track 3 claim from `README.md` until Merge 14 lands. `README.md:11` states the repository must not claim Track 3 without the MCP demonstration; it currently claims it.
- Record that the captured rehearsal ran with `GREENLIGHT_MIN_SPANS=90` while the receipt renders the default of 200, so no stored evaluation met the documented sample floor. This is distinct from the code fix in R-13.
- Correct the delivery history: the thirty issues map to PRs #33–#62 including two issue-0 repair PRs (#56, #62), issue #12 is absent, and five substantial integration commits landed directly on `main` after issue closure.

**Gate:** No documentation claims an evidence chain that the system cannot verify.

### Merge 01 — Reproducible build and runtime

- Pin Node 24 LTS across local tools, CI, and images.
- Declare deterministic workspace build order.
- Package migrations.
- Add production start scripts.
- Test the compiled API artifact.

**Gate:**

```bash
npm ci
npm run verify
npm run build
node apps/api/dist/server.js
```

All pass from a clean checkout.

### Merge 02 — Boundary validation and fail-closed errors

- Add Zod schemas to every route.
- Delete fabricated GitHub changes.
- Delete window widening.
- Reject null required metrics.
- Add typed dependency errors.
- Fix CORS configuration.

**Atomic-release constraint:** deletion of the SigNoz-to-ClickHouse fallback is implemented in Merge 04. Merge 02 and Merge 04 may be reviewed separately, but they must be deployed as one release. Deploying Merge 02 alone would retain a known unsupported evidence path; deploying the fallback deletion without Merge 04 would leave no query path.

**Joint Merge 02/04 gate:** Invalid or unavailable integrations cannot produce metrics, verdicts, or verified evidence, and the supported SigNoz query path has passed the Merge 04 spike.

### Merge 03 — PostgreSQL and corrected domain model

- Add transactional PostgreSQL migrations.
- Introduce baseline snapshots, incidents, recovery relationships, and evidence states.
- Add idempotency constraints.
- Add transactions and audit events.

**Gate:** Candidate and recovery identity is explicit; retries create no duplicates or partial records.

### Merge 04 — Supported SigNoz adapter

**Prerequisite spike — time-boxed, complete before planning any dependent merge.**

Nothing in this plan has yet demonstrated that the supported query API can serve GreenLight's queries. The committed payloads in `signoz/queries/` use the superseded Query Builder shape, the configured `SIGNOZ_API_KEY` returns HTTP 401 against the running stack, and the ClickHouse fallback is precisely why this was never discovered. Merges 04, 07, 10, 11 and 14, and roughly half of the §6 acceptance gate, assume it works.

1. Mint a service-account API key in the SigNoz UI and confirm it authenticates.
2. Rewrite one query — request count — against the current supported request schema for the pinned SigNoz version.
3. Execute it filtered on `service.name`, the baseline `service.version`, `deployment.environment.name`, and the demo route, over a window with known traffic.
4. Reconcile the result against the same window counted directly in the telemetry store using an offline, operator-only diagnostic. This comparison must not run inside the API or worker and must not populate an evaluation or receipt.

If count, p95 and error rate cannot be retrieved per route and per version, stop and revise this plan before proceeding. The architecture in §4 depends on it.

- Implement the current supported query API.
- Delete the SigNoz-to-ClickHouse fallback deferred from Merge 02, together with the container-name and Docker-socket dependencies.
- Apply complete service/version/environment/route/time filters.
- Query real count, p90, p95, and error rate.
- Add response validation, retry, timeout, and backoff.

**Gate:** Invalid credentials return `integration_error`; no fallback or alternate window is used; no application component requires Docker access.

### Merge 05 — API, worker, and transactional jobs

- Separate ingestion/read endpoints from background integration work.
- Add PostgreSQL-backed jobs/outbox.
- Add durable retries and dead-letter/error state.

**Gate:** API restarts do not lose accepted synchronization or evaluation work.

### Merge 06 — GitHub App integration

- Use GitHub App authentication.
- Verify webhook signatures.
- Add delivery idempotency and pagination.
- Require deterministic primary workflow configuration.
- Emit work for all related workflow runs.

**Gate:** Replayed webhooks create no duplicates; ambiguity and outages are visible.

### Merge 07 — Real CI trace export

- Export reconstructed workflow/job/step spans through OTLP.
- Attach the AI link only to the primary root.
- Verify the root trace through SigNoz.
- Persist export attempts and status.

**Gate:** A receipt exposes a CI trace only after the expected span tree is verified in SigNoz.

### Merge 08 — Real Claude provenance

- Capture a real Claude Code trace.
- Verify exact trace and parent span.
- Verify expected service/resource identity and time relationship.
- Distinguish missing, invalid, unverified, and verified.

**Gate:** Synthetic smoke traces cannot satisfy the Claude evidence requirement.

### Merge 09 — Immutable LMS build and deployment

- Fix the LMS test suite.
- Publish the demo repository and workflow.
- Build, test, sign, and publish one image per SHA.
- Deploy by digest.
- Derive health probes from the deployment target; do not hardcode a host, port, service, or actuator path.
- Emit and verify `deployment.started`, `deployment.succeeded`, and `deployment.failed` spans through OTLP.
- Persist the deployment trace ID and verification state.
- Add readiness, version visibility, and safe rollback.

**Gate:** Running image digest, commit SHA, and SigNoz `service.version` agree; a non-default deployment target passes its configured health probe; the deployment marker trace resolves in SigNoz.

### Merge 10 — Deterministic evaluation and recovery

- Capture immutable baseline snapshots.
- Persist exact observed and recovery windows.
- Wait for window completion and ingestion.
- Reuse the same baseline snapshot for recovery.
- Persist exact thresholds.
- Add exact boundary tests.

**Gate:** Candidate and recovery baseline timestamps are identical, and no window predates its deployment.

### Merge 11 — Correct receipt and evidence assembly

- Assemble from explicit incident/candidate/recovery IDs.
- Use each deployment's actual SHA and image digest.
- Include verification state.
- Generate stable evidence ordering.
- Version the receipt schema.

**Gate:** The bad change receipt shows the correct candidate, regression, recovery, and verified evidence.

### Merge 12 — GreenLight observability and operational health

- Add Fastify, HTTP, worker, and database instrumentation.
- Isolate service resource configuration.
- Add JSON logging and request IDs.
- Add `/livez`, `/readyz`, and dependency status.
- Add graceful termination and telemetry flushing.

**Gate:** `greenlight-api` and `greenlight-worker` contain only their own spans, and dependency failures are visible.

### Merge 13 — Complete frontend

- Render status, versions, thresholds, windows, provenance, and evidence.
- Add loading, empty, invalid, unverified, insufficient, integration-error, regressed, and recovered states.
- Add runtime response parsing.
- Serve through a hardened static server.
- Add CSP and production headers.

**Gate:** Blocking browser E2E covers all material receipt states.

### Merge 14 — Genuine SigNoz MCP investigation

- Use an official MCP client.
- Query the candidate and baseline comparison.
- Require non-null metrics.
- Return three verified candidate slow traces.
- Store sanitized provenance.

**Gate:** Network evidence proves MCP was contacted, and every returned trace resolves in SigNoz.

### Merge 15 — Production containers and infrastructure

- Add non-root, multi-stage API, worker, and Web images.
- Use read-only filesystems where possible.
- Add image signing, SBOM, and scanning.
- Use managed PostgreSQL for production.
- Add TLS, secret management, private networks, and resource policies.
- Pin SigNoz images and configure JWT security.
- Add backup, restore, canary, and rollback procedures.

**Gate:** Staging deploys only immutable digests and passes restore and rollback drills.

### Merge 16 — Blocking CI/CD and final rehearsal

Required pipeline:

1. Clean dependency installation
2. Formatting and lint
3. Typecheck
4. Unit tests
5. Shell and Git-hook tests
6. PostgreSQL integration tests
7. SigNoz API and OTLP integration tests
8. Compiled-start test
9. Browser E2E
10. LMS test suite
11. Image build
12. SBOM, secret, dependency, and image scans
13. Staging deployment
14. End-to-end evidence-chain acceptance
15. Manual production approval
16. Canary deployment
17. Post-deployment verification

**Gate:** The complete evidence chain succeeds twice from a clean environment.

## 6. Executable acceptance gate

Create a blocking `scripts/acceptance.sh` or equivalent CI workflow that fails unless every assertion passes.

- [ ] Fresh checkout installs, verifies, and builds.
- [ ] Compiled API and worker start successfully.
- [ ] Liveness and readiness behave independently.
- [ ] Invalid GitHub or SigNoz credentials produce explicit dependency failures.
- [ ] A real Claude trace and exact parent span resolve in SigNoz.
- [ ] The commit contains the verified traceparent.
- [ ] A GitHub workflow, jobs, and steps are synchronized.
- [ ] Every workflow has a reconstructed SigNoz trace.
- [ ] The primary root links to the verified Claude span.
- [ ] CI export status is `verified`.
- [ ] An immutable LMS image is deployed by digest.
- [ ] Deployment health succeeds against a configured non-default hostname and port; no production code assumes `127.0.0.1:8081`.
- [ ] `deployment.started` and the terminal `deployment.succeeded` or `deployment.failed` span resolve in SigNoz.
- [ ] The verified deployment trace ID is persisted and used by deployment-impact evidence.
- [ ] SigNoz contains the exact deployed `service.version`.
- [ ] Deployment readiness is not declared before version visibility.
- [ ] Baseline traffic meets the configured sample floor.
- [ ] Candidate observed window starts after readiness and is not widened.
- [ ] The bad deployment produces a repeatable regression.
- [ ] Recovery reuses the exact baseline snapshot.
- [ ] Recovery produces a verified healthy evaluation.
- [ ] The regressed receipt shows the correct recovery.
- [ ] All evidence links resolve to the expected identifiers.
- [ ] A genuine MCP call returns non-null comparison values and three verified candidate traces.
- [ ] GreenLight API and worker telemetry is correctly labeled.
- [ ] Browser E2E passes without `continue-on-error`.
- [ ] LMS tests pass.
- [ ] Security and image scans pass.
- [ ] PostgreSQL backup and restore pass.
- [ ] Canary rollback restores the previous known-good release.

## 7. Production rollout and rollback

### Rollout

1. Run backward-compatible database migrations as a separate job.
2. Deploy the new worker with processing paused.
3. Deploy the new API to staging.
4. Run readiness and contract checks.
5. Resume staging worker processing.
6. Run the complete evidence-chain acceptance test.
7. Promote exact tested image digests.
8. Deploy a production canary.
9. Verify GreenLight telemetry, queue health, database health, and SigNoz queries.
10. Expand traffic only after the canary passes.

### Rollback

1. Pause new background jobs if data compatibility is uncertain.
2. Route traffic to the previous API/Web image digests.
3. Restore the previous worker image.
4. Keep migrations backward-compatible with at least one prior release.
5. Use forward-repair migrations rather than destructive automatic down migrations.
6. Verify queue, database, SigNoz, and receipt reads after rollback.
7. Record rollback and evidence status in the audit log.

## 8. Final definition of done

GreenLight is production-ready only when:

- The application builds and starts from a clean checkout and immutable images.
- SigNoz is the exclusive telemetry evidence source.
- No integration failure can create plausible evidence.
- A real Claude trace is linked through a real GitHub Actions trace.
- Deployment identity is verified by immutable digest and SigNoz service version.
- Baseline, candidate, and recovery evidence use exact persisted windows.
- Recovery is linked to the correct regression incident.
- Every authoritative receipt link is verified.
- The SigNoz MCP investigation is genuine.
- GreenLight observes itself correctly.
- All automated quality, security, LMS, browser, backup, and rollback gates pass.
- The entire evidence chain succeeds twice from a clean environment.
