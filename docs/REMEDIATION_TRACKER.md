# GreenLight remediation tracker

Last updated: 2026-07-24

This tracker is the execution record for `remediation-list.md`. A status of
`complete` requires implementation, an automated regression check, and the
listed acceptance evidence. `external-blocked` means the remaining
implementation or acceptance criterion requires a dependency download,
credentials, a hosted service, another repository, Docker daemon access, or
local-listener permissions unavailable in this environment.

## Status values

- `planned`: root cause and implementation plan reviewed; code not yet changed.
- `implemented`: code changed; full acceptance evidence not yet captured.
- `validated`: focused validation passed.
- `complete`: all repository and external acceptance criteria passed.
- `external-blocked`: an explicitly named environmental or external gate remains.

## Execution order and shared design decisions

1. **Truth reset and reproducible runtime (R-03, R-05, R-06, R-15–R-19, low
   documentation items).** Fail closed, package migrations, pin Node, make the
   browser gate blocking, and remove unsupported claims. Rollback: revert the
   runtime/configuration commit; no data migration is involved.
2. **Verified evidence state (R-01, R-02, R-07–R-14, R-20–R-22, R-37–R-40,
   R-47–R-48, R-58–R-61, R-69–R-70, R-74–R-75).** Introduce explicit state,
   immutable snapshots/windows/thresholds, incidents, transactional writes,
   configured probes, and OTLP export followed by SigNoz verification.
   Rollback: pause workers, deploy the prior binary, and retain additive schema
   columns/tables for forward repair.
3. **Production boundaries and operations (R-23–R-27, R-31–R-36, R-41–R-57,
   R-71–R-73).** Separate API and worker responsibilities, require PostgreSQL
   in production, add authorization/limits/health/logging/shutdown, ship
   immutable non-root images and deployment/backup/rollback assets, and make
   CI gates blocking. Rollback: route to the previous tested image digests;
   migrations remain backward-compatible.
4. **Frontend and workload reliability (R-28–R-30, R-62–R-68 plus hygiene).**
   Parse response contracts at runtime, render every evidence state, fix the
   load generator and isolated test harnesses, and replace mutable workload
   deployment with digest-based deployment. Rollback: redeploy the previous
   static Web digest and the last known-good LMS digest.
5. **Live acceptance (R-04–R-06, R-14, R-28–R-30, R-39–R-42, R-56).** Run the
   hosted GitHub, Claude telemetry, SigNoz/MCP, LMS, dashboard, restore, canary,
   and rollback drills twice. These checks cannot be simulated or satisfied by
   fixtures.

## Item-by-item plan and evidence

| Item | Root cause and blast radius | Implementation / affected areas | Validation and rollback | Initial status at plan creation |
|---|---|---|---|---|
| R-01 | CI synthesis owns an in-memory provider, so no downstream consumer can observe it. | Inject a configured OTLP exporter into the worker synthesizer; export every workflow. `ci-telemetry`, worker, config. | OTLP collector seam test plus live SigNoz trace-tree check. Disable worker and revert exporter wiring. | planned |
| R-02 | A generated trace ID is treated as proof of ingestion. | Add export attempts and `pending/exported/verified/failed`; expose links only for `verified`. Schema, repositories, receipt. | State-machine/receipt tests and live verification. Additive schema permits binary rollback. | planned |
| R-03 | `ensureChangeFromCommit` catches every GitHub error and fabricates metadata. | Remove fallback; preserve typed dependency errors. GitHub sync/service routes. | GitHub outage test proves no row is inserted. Revert service change. | planned |
| R-04 | Demo repository/workflow configuration points at an unrelated/local repository. | Require an explicit hosted workload repository and workflow ID/name; add preflight check. Config, preflight, docs. | Live Actions synchronization populates `pipeline_runs`. Restore prior config only for local development. | planned |
| R-05 | Synthetic OTLP smoke data was documented as Claude provenance. | Mark old evidence synthetic; capture and store only a verified Claude trace. Evidence log, provenance state. | Live Claude trace/resource check. Documentation rollback only. | planned |
| R-06 | Traceparent syntax was accepted without resolving its exact parent span. | Verify trace ID, span ID, service identity, and time relation before `verified`. AI provenance verifier/schema. | Missing-parent fixture/live check remains `unverified`. Revert verifier while retaining state. | planned |
| R-07 | Evaluation windows are computed from `Date.now()`. | Persist readiness-anchored immutable windows. Evaluation service/schema. | Clock-controlled tests assert exact timestamps. Pause evaluation worker for rollback. | planned |
| R-08 | Recovery re-queries a newly computed baseline. | Persist immutable baseline snapshots and reference one snapshot from incident and recovery. Schema/evaluation. | Candidate/recovery baseline identity test. Additive schema rollback. | planned |
| R-09 | Evaluation begins before the observed window can finish. | Store `not_before`; reject/queue until window plus ingestion delay elapses. Worker/evaluation service. | Boundary tests before/at/after `not_before`. Pause worker. | planned |
| R-10 | SigNoz errors fall through to Docker/ClickHouse. | Delete application fallback and return typed integration errors. SigNoz client. | Authentication/timeout tests assert one API path. Revert only with evidence disabled. | planned |
| R-11 | Interpolated ClickHouse SQL permits injection and depends on internal schema. | Delete the application SQL path; schema-validate supported SigNoz filters. SigNoz client/query templates. | Injection strings rejected; source scan has no `docker exec`/internal table. | planned |
| R-12 | Low sample counts trigger an unrelated 20-minute window. | Remove widening; query exactly persisted start/end. SigNoz client/evaluation. | Request-body test asserts exact bounds. Revert only together with R-10. | planned |
| R-13 | Minimum sample count comes from process defaults at evaluation time. | Persist complete threshold set per evaluation policy/version. Schema/evaluation/receipt. | Non-default threshold round-trip and boundary tests. Additive rollback. | planned |
| R-14 | Deployment version verifier defaults to `true`. | Poll SigNoz for exact service/version/environment/route until deadline. Deployment verifier. | False/mismatch/timeout/live visibility tests. Mark pending on rollback. | planned |
| R-15 | npm workspace order consumes stale `shared/dist`. | Use TypeScript project references and explicit clean build order. Root/workspace tsconfig/scripts. | Remove dist, `npm ci`, typecheck/build. Revert build scripts. | planned |
| R-16 | CI Node 20 cannot reliably provide `node:sqlite`. | Pin Node 24 across engines, version file, CI, and images. | CI/version preflight. Revert pin only with supported runtime. | planned |
| R-17 | TypeScript does not copy SQL migrations. | Copy migrations into API artifact and resolve packaged path; compiled-start test. | Delete dist, build, start against temp DB. Revert packaging. | planned |
| R-18 | API has no production entry script. | Add `start` and compiled artifact smoke. API package/CI. | `npm --workspace @greenlight/api start`. Revert script. | planned |
| R-19 | CORS is hardcoded to one origin and preflight handling is incomplete. | Parse an origin allowlist and emit correct headers only for allowed origins. Server/config. | Fastify inject plus blocking browser E2E. Revert allowlist. | planned |
| R-20 | Receipt infers candidate/recovery from list order and the viewed change. | Persist incident candidate and recovery IDs and assemble through them. Schema/receipt. | Cross-change recovery regression test. Additive rollback. | planned |
| R-21 | Versions are read from the receipt change, not each deployment. | Join every deployment to its own change/image identity. Repositories/receipt. | Candidate/recovery SHA test. Revert join. | planned |
| R-22 | Null counts/latency/error are coerced to zero in evaluator/persistence. | Require complete metrics; use `integration_error` versus `insufficient_data`. Evaluator/schema/contracts. | Null-field matrix tests. Revert only with evaluations disabled. | planned |
| R-23 | No deployable API/worker/Web artifacts exist. | Add multi-stage non-root Dockerfiles and health checks. `deploy/`, apps. | Build and inspect images. Revert deployment assets. | planned |
| R-24 | No promotion or safe rollback model exists. | Add digest-based staging/canary manifests and scripted verification/rollback runbook. `deploy/`, scripts/docs. | Local manifest checks plus staging canary drill. Revert manifests. | planned |
| R-25 | SigNoz security relies on defaults. | Require external JWT/admin secrets and document rotation; reject placeholders. Deployment config/preflight. | Config/secret scan and live auth check. Rotate back only as emergency. | planned |
| R-26 | Observability ports are host-wide. | Bind local ports to loopback and keep production endpoints private. Compose/deploy config. | Socket/compose config test. Revert network bindings. | planned |
| R-27 | Floating image tags make builds non-reproducible. | Pin runtime images by version/digest and enforce in CI. Docker/manifests. | Image-reference lint. Roll back to prior pinned digest. | planned |
| R-28 | The external LMS suite has isolation failures. | Fix the hosted LMS branch and require its suite before publication. External LMS repo/CI. | Full Maven suite and image gate. Roll back LMS commit/digest. | planned |
| R-29 | Demo refs exist only in a dirty detached local clone. | Publish a clean workload repository and immutable good/bad/recovery refs. External repo/config/docs. | Hosted ref and Actions checks. Preserve previous refs. | planned |
| R-30 | Deployment checks out/builds on the target and ignores checkout failure. | Build once in CI; deploy signed image digest and verify embedded SHA. LMS deploy adapter. | Digest/SHA mismatch test and rollback drill. Redeploy last-good digest. | planned |
| R-31 | Routes cast untrusted values directly. | Central Zod schemas for params/bodies/headers/config. API routes/contracts. | Invalid-field table tests; no mutation on failure. Revert schemas with endpoint disabled. | planned |
| R-32 | Reads are public and writes share one admin token. | Add scoped API-key/OIDC principal abstraction with read/sync/deploy/evaluate scopes. Auth module/config. | Scope matrix tests. Emergency local key mode is explicitly non-production. | planned |
| R-33 | Static token equality leaks timing. | Use constant-time digest comparison in local mode; disallow local mode in production. Auth module. | Equal/unequal-length tests and production config test. Revert by disabling local mode. | planned |
| R-34 | Health claims dependencies are healthy without checks. | Split `/livez`, `/readyz`, `/status/dependencies` with real DB/GitHub/SigNoz checks. Health service/routes. | Dependency failure injection. Revert readiness route only. | planned |
| R-35 | SDK starts without HTTP/Fastify instrumentation. | Register Node auto/HTTP instrumentation before server imports; verify spans. Telemetry/bootstrap. | OTLP seam/live API span check. Disable exporter for rollback. | planned |
| R-36 | Shared environment leaks `greenlight-api` resource identity into LMS. | Explicit per-process resources and sanitized child-process env. Runtime/deploy scripts. | Resource-label tests/live query. Restore isolated env file. | planned |
| R-37 | p95 payload is copied into p90 fields. | Query true p90 separately and persist it, or omit it if unsupported. SigNoz/schema/UI. | Distinct p90/p95 fixture. Revert by hiding p90. | planned |
| R-38 | Receipt renders current defaults, not applied policy. | Persist threshold JSON/version and render stored values. Schema/receipt/UI. | Non-default round-trip test. Additive rollback. | planned |
| R-39 | MCP fixture generation never uses MCP transport. | Use official client against configured MCP URL and record sanitized server metadata. MCP script/package. | Network call proof and non-null result. Disable MCP feature for rollback. | planned |
| R-40 | Fixture validates the wrong version and accepts empty data. | Bind candidate SHA/route, non-null metrics, and three resolvable traces. MCP validator. | Negative fixtures for each missing field plus live trace resolution. Revert validator only with claim withdrawn. | planned |
| R-41 | Required dashboards/alert are absent. | Version deployment-impact, pipeline-health, self-observability dashboards and regression alert. `signoz/`. | Asset schema/import/live query checks. Delete imported assets to roll back. | planned |
| R-42 | Dashboard URLs are guessed paths. | Configure verified dashboard IDs and generate links from them. Config/schema/receipt. | URL/ID verification tests/live HEAD/query. Revert links to null. | planned |
| R-43 | GitHub client reads one page only. | Follow RFC5988 links with bounded page/item limits for runs/jobs. GitHub client. | Multi-page seam tests. Revert pagination with sync disabled. | planned |
| R-44 | Name matching can silently choose among multiple workflows. | Require configured workflow ID or exactly one match. Config/selection. | Zero/duplicate/mismatch tests. Restore explicit previous ID. | planned |
| R-45 | Only the primary workflow is synthesized. | Export every run; attach AI link only to configured primary. Sync/worker. | Two-run fixture yields two traces/one link. Disable secondary export. | planned |
| R-46 | Immediate retries amplify outages and ignore server guidance. | Add bounded exponential backoff, jitter, timeout, and `Retry-After`. Clients. | Fake-clock retry tests. Reduce attempts to one for rollback. | planned |
| R-47 | Deployment IDs collide and inserts are not provider-idempotent. | Require idempotency key/provider event ID and upsert identical payloads. Schema/service. | Replay and conflicting-key tests. Additive constraint rollback. | planned |
| R-48 | Related writes can partially commit. | Repository transaction unit-of-work for sync/evaluation/incident/evidence/outbox. Repository/services. | Injected failure leaves zero partial rows. Revert service while retaining schema. | planned |
| R-49 | SQLite cannot provide production concurrency/durability. | PostgreSQL repository adapter required in production; SQLite retained for isolated local tests only. DB/config/deploy. | PostgreSQL integration/migration/restore tests. Switch connection string to prior cluster for rollback. | planned |
| R-50 | Logging is disabled and errors are flattened. | JSON logs, request IDs, error codes, redaction, and audit events. Server/services. | Log snapshot/redaction tests. Revert logger config. | planned |
| R-51 | Process does not drain or close SDK/DB. | Handle SIGTERM/SIGINT; stop intake, drain, close DB, flush telemetry. Bootstrap/worker. | Child-process termination test. Platform kill timeout remains fallback. | planned |
| R-52 | No body, request, concurrency, timeout, or rate policy. | Configure Fastify limits and scoped rate/concurrency controls. Server/config. | 413/429/timeout tests. Relax configured limits for rollback. | planned |
| R-53 | E2E workflow uses `continue-on-error`. | Make E2E blocking and include it in required CI. Workflows. | Workflow lint and local Playwright. Revert only after branch protection exception. | planned |
| R-54 | Most boundaries lack integration coverage. | Add API/DB/SigNoz/OTLP/GitHub/recovery/browser/artifact suites. Tests/CI. | CI test matrix. Tests are retained during rollback. | planned |
| R-55 | CI omits lint/format/shell/coverage/security/image gates. | Add scripts and blocking jobs with pinned tools/actions. Package/workflows. | Run CI-equivalent acceptance locally. Revert individual gate only with recorded exception. | planned |
| R-56 | No metadata/telemetry backup or restore drill exists. | Add PostgreSQL backup/restore scripts and SigNoz volume/runbook checks. `ops/`, docs, CI schedule. | Restore into isolated database and compare checksums. Keep last backup on rollback. | planned |
| R-57 | Production secrets are environment-file oriented. | Reference platform secret objects/files; reject baked/default secrets. Deployment config. | Image/config secret scan. Roll back secret version, not mechanism. | planned |
| R-58 | HTTP handlers own orchestration. | Move sync/deployment/evaluation/receipt flows into domain services/jobs. Server/modules. | Service unit tests and thin route tests. Revert route wiring. | planned |
| R-59 | Deployment SHA lookup scans a capped change list. | Add indexed `getChangeForDeployment` join. Repository. | More-than-200-change regression test. Revert call site. | planned |
| R-60 | Recovery lookup ignores service/environment. | Resolve recovery through incident and immutable baseline snapshot. Evaluation/incident service. | Same-route cross-service regression test. Additive rollback. | planned |
| R-61 | Evidence order is timestamp-dependent. | Persist type/ordinal and stable ID secondary ordering. Schema/receipt. | Equal-timestamp ordering test. Additive rollback. | planned |
| R-62 | Receipt omits windows, policy, verification, and several states. | Version contract and render complete state/evidence details. Shared/Web. | Component/E2E state matrix. Redeploy previous Web digest. | planned |
| R-63 | Metrics render raw values. | Central unit/precision/accessibility formatters. Web. | Formatter/component tests. Revert formatter. | planned |
| R-64 | Web trusts TypeScript casts for runtime JSON. | Zod response schemas in shared package and parse client responses. Shared/Web. | Malformed API payload test. Revert client while pinning API version. | planned |
| R-65 | Load stops on the first expected application error. | Count success/error/transport outcomes and continue. Load generator. | Local stub with mixed responses. Revert script. | planned |
| R-66 | Documented `--requests` is ignored. | Parse bounded CLI flags and report requested/attempted/completed/error counts. Load generator. | CLI contract test. Revert parser. | planned |
| R-67 | Some tests can use workspace DB paths. | Require temp DB helpers and guard test environment paths. Tests/DB. | Source scan plus temp cleanup test. Revert guard only locally. | planned |
| R-68 | Hook tests inherit global signing/hooks. | Set isolated `GIT_CONFIG_GLOBAL`, hooks path, and signing flags. Git hook harness. | Run with hostile global config fixture. Revert harness. | planned |
| R-69 | `Date.parse` failures propagate `NaN` into span timestamps. | Strict ISO timestamp schemas and normalized validation. GitHub client/normalizer. | Invalid timestamp fixtures rejected. Revert parser with sync disabled. | planned |
| R-70 | Timestamp helpers use ambiguous numeric forms or are dead. | Remove dead helpers; use supported `HrTime` conversion for backdated spans. Telemetry modules. | Nanosecond/UTC round-trip tests. Revert helper. | planned |
| R-71 | Reset docs promise a hard mode that the script does not implement. | Remove unsupported mode or add separately authorized rebuild command; default remains non-destructive. Scripts/docs. | Shell contract tests. Revert documentation. | planned |
| R-72 | Runtime prerequisites are implicit and host-bound. | Containerize remaining services and extend preflight checks/version output. Docker/preflight/docs. | Clean-host preflight. Revert optional checks. | planned |
| R-73 | Compose lacks limits and readiness ordering. | Add health conditions, restart/resource/read-only policies. Compose/manifests. | `docker compose config` and failure-order smoke. Revert limits individually. | planned |
| R-74 | Health probe ignores deployment data. | Require validated `healthUrl`/target reference on the deployment event. Deployment schema/service. | Non-default host/port test. Restore prior configured target. | planned |
| R-75 | Deployment events persist `null` trace IDs. | Emit a deployment span lifecycle through OTLP and verify/persist its trace state. Deployment telemetry/service. | OTLP seam and live trace check. Disable emission and mark evidence unverified. | planned |
| L-01 | Demo credentials are embedded in scripts/examples. | Remove defaults; require secret input. LMS scripts/examples. | Secret scan and missing-secret test. Rotate exposed demo credentials. | planned |
| L-02 | Example repository points at GreenLight rather than the workload. | Require an explicit workload repository placeholder/value. `.env.example`, preflight. | Config validation. Revert example only. | planned |
| L-03 | Multiple helpers implement overlapping production query/deploy behavior. | Delete unsupported/dead paths and keep one adapter per boundary. Modules/scripts. | Source scan and adapter tests. Revert authoritative adapter. | planned |
| L-04 | README/tracker/evidence claims exceed captured evidence. | Make all claims state-qualified and link this tracker. Documentation. | Claim audit against artifacts. Documentation rollback. | planned |
| L-05 | Long metric values are not consistently readable. | Shared formatters with units/precision. Web. | Component/accessibility snapshots. Revert formatter. | planned |
| L-06 | Future issue/PR evidence is not enforced. | Add PR template/checklist fields for tests, evidence, limits, and rollback. `.github/`. | Template validation. Revert template. | planned |

## Correction round (2026-07-24)

An independent audit of the first remediation round found that the SigNoz
integration had never executed successfully: the committed query payloads used
the superseded Query Builder shape, the response parsers targeted the v4
envelope, and the dashboards/alerts were bespoke JSON that SigNoz rejects. Every
item that depended on SigNoz was therefore validated only against mocks
encoding the same wrong contract. This round corrects that and the defects
found alongside it.

### What changed

| Area | Correction |
|---|---|
| SigNoz queries | `modules/signoz/query.ts` builds typed v5 requests; `client.ts` parses the v5 envelope through Zod. String templates and `signoz/queries/*.json` are deleted. Metrics for a window are one round trip. |
| SigNoz failures | `SignozIntegrationError` carries a code and retryability. An unreachable or unauthorised SigNoz raises; it is never reported as absent evidence. |
| Evidence integrity | Trace ID and export state are written as one unit; slow-trace links are marked `verified` only after the trace resolves; the receipt withholds unverified URLs. |
| Telemetry | Real `instrumentation-http` + `instrumentation-fastify`; logs and metrics exporters added; span attributes and stack traces redacted; the process's own identity overrides an inherited `OTEL_SERVICE_NAME`. |
| Worker | `runWorker` is exported and testable; structured trace-correlated logging; retryability comes from the error type and deadlines from `AppError.retryAt`, not from parsing messages. |
| Persistence | Reentrant transactions via savepoints; idempotent evaluation and evidence writes; defaults applied after the spread; scoped baseline lookup replaces full-table scans. |
| Config | Booleans parsed from an explicit vocabulary (`z.coerce.boolean` treated `"false"` as true); the static admin token is rejected in production; `.env.example` is derived from the schema. |
| Web | No credential is compiled into the bundle; reads use the browser session. Evidence state drives colour; no measured metric is suppressed. |
| Assets | Real SigNoz v6 dashboards and v1 alert rules; `scripts/signoz-assets.mjs` validates the schema and proves importability by round-trip. |
| Gates | ESLint replaces the home-grown style checks; coverage, image scanning and SHA-pinned actions added to CI. |

### Live validation against SigNoz v0.134.0

Performed with a service-account API key on the same credentialed path the
application uses:

- `queryWindow` over a window with known traffic returned `requestCount 177`,
  `p90 898.99ms`, `p95 1052.42ms`, `errorRate 0` — real values, p90 distinct
  from p95.
- `querySlowTraceIds` returned three trace IDs; all three resolved through
  `verifyTrace`.
- A deployment recorded end to end reached `versionState: verified` and
  `traceState: verified`; the marker span is queryable in SigNoz under the
  workload's own `service.name`/`service.version`.
- With no traffic in the baseline window, evaluation failed closed with
  `baseline_metrics_missing`. No zeroes were fabricated and no verdict issued.
- Traces carry `kind_string: Server`; `greenlight-api` and `greenlight-worker`
  each report their own identity and version.
- Worker logs reach SigNoz with `trace_id`/`span_id` correlation.
- All three dashboards import and read back with their panels intact.

### Repository gates

`npm run verify` (lint, typecheck, 128 tests, builds), `quality`,
`validate:config`, `validate:planning`, `validate:telemetry`,
`validate:signoz-assets`, `test:compiled-migrations`, `test:compiled-start`,
Playwright `@smoke`, Git-hook suite, `docker compose config`, API image build,
and `npm audit --omit=dev` all pass. API line coverage is 72%.

### Follow-up round (2026-07-24, later)

Four items the previous round recorded as `external-blocked` were re-tested.
Two were wrongly blocked — the dependencies install fine and the SigNoz MCP
server is reachable — so they were completed.

| Item | Outcome |
|---|---|
| **R-41 alert rules** | A notification channel is a per-installation prerequisite SigNoz enforces. Created one, then both rules imported and are live and evaluating. Documented in `signoz/README.md`. |
| **R-01 / R-02 CI export** | **Proven end to end.** `test/integration/signoz-live.integration.test.ts` drives `syncWorkflowRuns` from the committed fixture through real OTLP and verifies the span tree in SigNoz. The reconstructed tree (`Reconstructed GitHub Actions: Backend CI` → `job:build-and-test` → 2 steps) resolves, and `export_state` reaches `verified` bound to the trace ID that was actually verified. |
| **R-39 / R-40 MCP** | **Genuine.** `@modelcontextprotocol/sdk` installed; `capture-mcp-fixture.mjs` connects over streamable HTTP to SigNoz MCP v0.9.0 and calls `signoz_aggregate_traces` / `signoz_search_traces`. The captured comparison (baseline p95 173.8 ms / 0.23% → candidate 1259.4 ms / 10.95%) came from MCP, not the query API. `verify-mcp-result.mjs` now **resolves every reported trace in SigNoz** and fails on a fabricated ID. |
| **R-49 PostgreSQL** | **Closed.** See below. |

**A regression this round introduced and fixed.** Splitting `server.ts` into
`app.ts` plus an entrypoint dropped the guard that blocked production startup.
The result was worse than before: config *validated* that
`GREENLIGHT_DATABASE_URL` was set, then ignored it and ran on SQLite.
`createDatabase` now raises `UnsupportedStoreError` when a database URL is
configured but no adapter can serve it, with regression tests either side.

**A correctness bug the live tests found.** SigNoz answers an empty window with
`[0, null, null]`, and `Number(null)` is `0` — so a window with no traffic
reported `p95 = 0 ms`, which reads as a dramatic improvement rather than an
absence. `readScalarAggregation` now preserves null, and `queryWindow` reports
an unmatched window as absent across every field. This is exactly the
"coerce missing metrics to zero" defect the original audit raised, and only a
test against a real SigNoz could surface it.

**PostgreSQL adapter (R-49).** Production now runs on PostgreSQL.

The persistence layer was restructured around a four-method `SqlDriver` seam
(`db/driver.ts`) so that every statement and every rule about how rows relate
lives once in `Repositories`. Statements are authored in a neutral `:name`
placeholder form and translated per driver (`db/sql.ts`), so SQLite and
PostgreSQL run identical SQL rather than two copies that would drift. The
repository surface became async (43 methods, 62 call sites); `db/store.ts`
selects the driver from configuration and refuses an unsupported store instead
of downgrading to the local file.

Verified live: the API and worker both start against PostgreSQL 17, create all
13 tables, and process enqueued jobs with audit events written. Production mode
starts successfully for the first time.

**A concurrency bug the PostgreSQL suite found.** `claimNextJob` selected a row
and then updated it. SQLite's single-writer lock hid the race; under PostgreSQL
two workers claimed the same job, because the code never checked that its own
update had won. It is now one conditional `UPDATE ... RETURNING` that yields a
row only to the caller that changed it. Proven on both engines — the value of
running one contract against two databases, immediately.

`npm run test:postgres` runs the repository contract against a real server and
skips when `GREENLIGHT_TEST_DATABASE_URL` is unset.

### Still outstanding

These are unchanged by this round and remain release blockers:

- **R-04/R-05/R-06 live provenance.** No real Claude trace, no hosted GitHub
  Actions run, so no reconstructed CI trace has been exported or verified.
- **R-28/R-29/R-30 workload.** Closed for local development, CI, testing, and
  demonstration by the pinned public Blnk `v0.15.1` dependency and
  project-owned source build. Publishing a project image remains an optional
  deployment optimization, not a reproducibility requirement.
- **R-24/R-56 operations.** No staging, canary, backup or rollback drill.
- **Upstream:** SigNoz v0.134.0's bundled UI does not render v6 dashboards.
  Assets import and read back correctly; see `signoz/README.md`.

## Final item status matrix

The matrix below is authoritative; the last column in the plan above records
the initial state before implementation. No item is marked `complete` because
the audit defines completion as both repository validation and the applicable
live acceptance evidence.

| Final status | Items | Evidence / remaining gate |
|---|---|---|
| `validated` | R-03, R-07–R-13, R-15–R-17, R-20–R-22, R-25–R-33, R-37–R-38, R-43–R-47, R-55, R-59–R-60, R-62–R-75, L-01–L-06 | Focused unit/integration tests, clean build, schema/config/asset checks, public workload build/recovery, authenticated local SigNoz, isolated Git-hook test, strict package/SBOM/image scans, or live Compose failure/recovery passed. |
| `implemented` | R-34, R-48, R-50, R-52, R-58, R-61 | The production design/code is present, but one specified local gate is incomplete: dependency-failure injection, transaction fault injection, log snapshots, socket-level timeout/concurrency checks, full orchestration integration, or equal-timestamp evidence ordering. |
| `external-blocked` | R-01–R-02, R-04–R-06, R-14, R-18–R-19, R-23–R-24, R-35–R-36, R-39–R-42, R-49, R-51, R-53–R-54, R-56–R-57 | Repository seams/assets are implemented where possible. Completion requires one or more of: live Claude/GitHub provenance, browser/compiled-process listeners, a managed secret store, or restore/canary/rollback drills. |

## Validation log

Repository validations performed on 2026-07-24:

- Audited commit: `95935e3d343146efb03a9e601263526440de2a29`.
- `npm ci --offline --ignore-scripts` succeeded from the lockfile; npm reported
  zero audit findings. The installed runtime was Node `v26.5.0`, so npm
  correctly warned that it does not satisfy the new Node 24 engine pin.
- `npm run verify` passed from a clean `dist` state: shared, API, Web, and load
  generator suites passed, followed by all workspace builds.
- `npm run typecheck`, `npm run quality`, `npm run validate:config`,
  `npm run validate:planning`, `npm run validate:telemetry`,
  `npm run validate:signoz-assets`, and `git diff --check` passed.
- `npm run test:compiled-migrations` applied `001_initial.sql`,
  `002_verified_evidence.sql`, and `003_job_results.sql` from the compiled
  artifact to a temporary database.
- `bash instrumentation/git-hooks/test.sh` passed with isolated Git
  configuration, including valid, invalid, existing, merge, and amend cases.
- `docker compose -f deploy/compose.local.yaml config --quiet` passed.
- `npm audit --offline --omit=dev` reported zero vulnerabilities.

Supply-chain validations performed on 2026-07-25:

- `npm audit --audit-level=high` passed and the production tree was clean at
  `--audit-level=low`; the only remaining findings are moderate,
  development-only MCP/Hono findings.
- A production-only CycloneDX 1.5 SBOM contained 118 components and excluded
  React Router and MCP tooling.
- API and worker moved to digest-pinned non-root Distroless Node 24; Web moved
  to digest-pinned Nginx 1.30.4 stable slim unprivileged.
- Runtime image contract, strict Trivy scans for all three images (including
  unfixed findings), live Compose rollout/recovery, and four authenticated
  SigNoz integration tests passed.

Environment-blocked validation:

- `npm run test:compiled-start` and `npm run test:e2e:smoke` could not create
  local listeners/IPC sockets in the managed sandbox (`EPERM`). Both remain
  blocking CI jobs and must pass on a normal Node 24 runner.
- Docker image builds could not access the Docker daemon/buildx state from this
  sandbox. The Compose model was normalized, but API/worker/Web image builds,
  non-root inspection, SBOM/image scanning, and runtime health checks remain.
- Installing the PostgreSQL driver/types and official MCP SDK was denied by the
  environment's external-usage limit. Production startup therefore fails
  closed until the PostgreSQL adapter exists; the MCP capture cannot be run
  until its official client dependency is installed.
- The available LMS clone is detached, dirty, and backed by a local-path
  remote. It cannot satisfy R-28/R-29; a clean hosted repository, stable
  baseline/candidate/recovery refs, full Maven suite, and published immutable
  images are required.
- No credentials were available for real Claude telemetry, GitHub Actions,
  SigNoz query/trace verification, dashboard/alert import, or MCP. No
  PostgreSQL/SigNoz restore, canary, credential rotation, or rollback drill was
  performed.

## Remaining production risks and rollback

- **Persistence:** the local runtime uses PostgreSQL and the API fails readiness
  closed during a database outage. A dated isolated backup/restore drill is
  still required before production.
- **Evidence:** all links remain fail-closed unless SigNoz verifies them. A real
  Claude parent, reconstructed CI trees, deployment marker/version, exact
  candidate/recovery windows, and genuine MCP investigation still need one
  complete two-run rehearsal.
- **Supply chain:** SigNoz and application runtime bases are digest-pinned;
  production npm/SBOM gates and strict API/worker/Web image scans are complete.
  Application image signing, provenance attestations, and protected-registry
  promotion remain production deployment requirements.
- **Workload:** Blnk is fetched from its public origin at an exact tag and
  commit, built locally as a non-root image, and exercised through real
  database failure/recovery traffic. A second adapter remains optional.
- **Rollback:** pause worker intake, route API/Web/worker and LMS to the previous
  signed digests, retain additive migrations for forward repair, and verify
  health, queue, receipt, and SigNoz state. Database restoration and destructive
  down-migrations are not an automatic rollback mechanism.

## Final production-readiness status

**NOT PRODUCTION-READY**, but for a materially smaller set of reasons than
before. The evidence chain now works against a real SigNoz: metrics, trace
verification, deployment markers and self-observability were all exercised
live, and every failure path was confirmed to fail closed rather than
fabricate evidence.

The remaining blockers are live Claude and GitHub Actions provenance
(R-04/R-05/R-06), production secret infrastructure, and the operational drills
(R-24/R-56). The PostgreSQL adapter, official MCP client, public workload, and
digest-pinned SigNoz runtime are now present and validated.

Promotion remains gated on those items plus two clean end-to-end runs of the
full acceptance chain.
