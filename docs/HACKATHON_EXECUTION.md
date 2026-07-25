# Hackathon remediation execution

Last updated: 2026-07-25

This is the durable execution record for the prioritized recommendations in
`audit/HACKATHON_AUDIT.md`. Work is committed in independently reversible
units. The first audit recommendation — one complete live evidence chain — is
an umbrella acceptance gate, so its prerequisites are implemented in
dependency order before the final live rehearsal.

Status values:

- `planned`: acceptance criteria and approach are recorded.
- `in-progress`: implementation or validation is active.
- `validated`: repository-controlled acceptance checks pass.
- `external-blocked`: only named credentials, publishing authority, or an
  unavailable external service remains.
- `complete`: repository and live acceptance evidence both pass.

## Program status

| ID | Priority | Improvement | Status | Primary acceptance gate |
|---|---|---|---|---|
| H-01 | P0 | Real baseline → regression → recovery evidence chain | planned | Every stored AI/CI/deploy/evaluation/MCP ID resolves in one live SigNoz; signed manifest saved |
| H-02 | P0 | Required blog, video, and submission dry run | planned | Public URLs and completed form checklist |
| H-03 | P0 | Public reproducible LMS/loan workload | complete | Blnk `v0.15.1` pinned; clean build, seed, outage/recovery, and 698 SigNoz spans verified |
| H-04 | P0 | Digest-pinned compatible Foundry stack | validated | Fresh gauge/forge/cast/smoke/MCP passed; re-import needs a post-rotation API key |
| H-05 | P0 | Actionable clean demo bootstrap | complete | One documented command succeeds or fails before startup with precise remediation |
| H-06 | P0 | Production dependency vulnerabilities | complete | Production audit/SBOM and strict API, worker, and Web image scans report zero high/critical findings |
| H-07 | P0 | Receipt 404 and persisted CI details | validated | Unknown SHA is 404; duration/slowest step survive database round trip |
| H-08 | P0 | Correct, live-tested error-rate alert | validated | True rate query fires and resolves against generated traffic |
| H-09 | P0 | Visible compatible SigNoz dashboards | complete | All 14 panels render at v0.134.0 with zero query errors; IDs recorded; API spans carry `http.route` |
| H-10 | P0 | Judge landing state | complete | Empty, degraded, unreachable, and verified paths each state what happened and what to run |
| H-11 | P1 | First-class custom metrics | planned | Metrics for verdicts, verification, queue and dependencies query in SigNoz |
| H-12 | P1 | API log/trace correlation | planned | API and worker logs query by request/job/commit and resolve trace IDs |
| H-13 | P1 | Persisted genuine MCP transcript | planned | Sanitized result and every cited trace resolve |
| H-14 | P1 | SigNoz alert-driven incident flow | planned | Authenticated idempotent webhook creates/updates an incident |
| H-15 | P2 | Meaningful service map | planned | Real topology is visible; omit if it adds no diagnostic value |
| H-16 | P1 | Verdict-first receipt and semantic list | complete | Verdict banner leads with both deltas; every badge carries a tone and a written meaning |
| H-17 | P1 | Navigation, status and evidence freshness | planned | Judge can navigate and see dependency/evidence state |
| H-18 | P1 | Actionable typed UI failures | planned | Auth/not-found/degraded/contract errors have distinct recovery paths |
| H-19 | P1 | Progressive technical detail | planned | Mobile flow keeps verdict first without hiding evidence |
| H-20 | P2 | Accessibility gates | planned | axe, keyboard, focus and mobile checks block CI |
| H-21 | P0 | Deterministic three-minute demo and backup | planned | Three consecutive rehearsals finish under 2:50; backup assets exist |
| H-22 | P1 | Architecture diagram and proof-first README | planned | Six-node diagram, proof table and five-minute quickstart verified |
| H-23 | P2 | GitHub Check/PR receipt | planned | Scoped, idempotent optional publisher with contract tests |
| H-24 | P2 | Evidence-completeness risk score | planned | Transparent deterministic score with no causal/AI claim |
| H-25 | P2 | Second public workload adapter | planned | Same adapter contract passes against a second public service |

## H-03 — Public reproducible loan workload

### Judging impact and root cause

The original demo path depended on a private, machine-specific Bhawana checkout
and credentials. Judges and CI could not reproduce it, and the fallback was
only a proposal. This made the product's central workload and SigNoz proof
non-portable.

### Implementation plan and architecture

- Compare multiple maintained public lending/financial candidates and select
  the smallest credible API workload with compatible licensing and native OTel.
- Fetch the selected release from its public origin at an exact tag and commit;
  do not vendor third-party source.
- Build a project-owned non-root runtime image and run PostgreSQL, Redis,
  migrations, API, and worker with health-gated Compose ordering.
- Generate a local secret, seed only synthetic loan-ledger data, and provide
  bounded healthy, not-found, real dependency-outage, and recovery traffic.
- Preserve standard OTel resource metadata with one exact, verifier-enforced
  compatibility patch.

The selected dependency is Blnk `v0.15.1` at
`c8fce93af4df6b1edb46ca97e570c55beff4cef9`, Apache-2.0. The comparison,
security/maintenance review, residual risks, and rollback are in
`integrations/blnk/DEPENDENCY_REVIEW.md`.

### Testing, security, operations, and rollback

Contract tests cover argument validation, bounded error traffic, seed creation,
and idempotent reuse. The fetch verifier proves origin, tag, SHA, and that the
approved OTel patch is the checkout's only modification. Compose validation,
cold source build, migration, health, authentication, non-root identity,
read-only runtime, seed, and dependency recovery are runtime gates.

PostHog and Typesense are disabled, data stores are not host-published, the
master key lives in an ignored mode-0600 file, capabilities are dropped, and
`no-new-privileges` is set. `down.sh` preserves local data by default; the
explicit `--volumes` option removes only this named Compose project's volumes.

### Validation evidence

- Exact public checkout, patch, image label, and non-root UID verified.
- Cold Docker build and ordered migration/startup passed.
- Missing auth returned 401; 180 baseline/recovery requests succeeded and 40
  harmless not-found requests were bounded.
- A real PostgreSQL outage produced 40 HTTP 500 requests; the safety trap
  restarted the database and all 60 recovery requests succeeded.
- SigNoz stored 698 versioned spans across 374 traces, including 42 error spans
  (40 `/balances` 500 and two `/health` 503); final services were healthy.
- `node --test integrations/blnk/workload.test.mjs`, Compose config validation,
  ESLint, shell syntax, and `git diff --check` passed.

## H-04 — Digest-pinned compatible Foundry stack

### Judging impact and root cause

The Foundry casting and generated lock used mutable `latest` references for
SigNoz, its collector, and MCP. PostgreSQL and ClickHouse were only
major/minor-pinned. A clean setup could therefore install a different,
incompatible stack without any repository change, making the central
observability proof non-reproducible.

### Implementation plan and architecture

- Select one compatibility set from the live working stack and upstream
  migration requirements.
- Pin semantic versions in the Foundry casting and generated lock so Foundry
  configuration remains readable and regenerable.
- Pin all six runtime images to immutable manifest digests in a separate,
  checked-in environment file consumed only by the safety override.
- Validate the casting, lock, CLI version, tag/digest correspondence, generated
  Compose model, running image content, API version, MCP health, and OTLP
  ingestion.

The selected matrix is SigNoz `v0.134.0`, collector `v0.144.6`, MCP `v0.9.0`,
PostgreSQL `16.14-trixie`, and ClickHouse server/Keeper `25.12.5`.
ClickHouse 25.12.5 satisfies SigNoz's stated migration prerequisite while
SigNoz v0.134.0 remains compatible with the v0.9.0 MCP alert APIs.

### Testing, security, operations, and rollback

`scripts/signoz-stack.test.mjs` rejects mutable references, missing pins,
tag/digest mismatch, and the wrong Foundry CLI contract. CI and local
acceptance run the validator. Compose normalization proves every resolved
runtime reference includes the approved digest; the live verifier compares
each container image's repository digest rather than trusting its display tag.

The safety override keeps UI, MCP, and OTLP on loopback, replaces generated
database/JWT values with operator-provided secrets, applies health ordering and
resource ceilings, and does not expose ClickHouse/PostgreSQL. A failed upgrade
must roll forward or restore a pre-upgrade backup before launching the previous
digest set; an in-place database downgrade is not supported.

### Validation evidence

- `foundryctl gauge -f casting.yaml` and `foundryctl forge -f casting.yaml`
  passed with Foundry `v0.2.16`; the regenerated lock contains no `latest`.
- Digest-pinned two-file Compose normalization and `config --quiet` passed.
- `node --test scripts/signoz-stack.test.mjs` — 3 tests passed.
- `npm run validate:signoz-stack` — all six compatible images validated.
- `scripts/signoz-runtime-verify.sh` matched all six live image digests,
  confirmed SigNoz `v0.134.0`, MCP `v0.9.0` liveness, and accepted a current
  OTLP span.
- The safety override exposed only `127.0.0.1` bindings and used the supported
  `SIGNOZ_TOKENIZER_JWT_SECRET`. The planned secret rotation invalidated the
  old local service-account key; imported assets remain in the preserved
  database, but the idempotent import read-back must be rerun after a new key is
  issued.

## H-05 — Actionable clean demo bootstrap

### Judging impact and root cause

The previous setup mixed an unchecked `.env`, host processes, SQLite, an
implicit Node version, a private workload path, and manually ordered services.
A judge could reach a late failure after several commands without knowing which
dependency or credential was wrong. That first-run uncertainty was a screening
risk even when the product code itself worked.

### Implementation plan and architecture

- Make `.env.demo.example` the checked-in demo contract and distinguish
  repository-controlled defaults from the one externally issued SigNoz API
  credential.
- Resolve Node 24 deterministically, verify Docker, Compose, Foundry, ports,
  public Blnk source, pinned SigNoz images, and configuration before startup.
- Generate mode-0600 PostgreSQL, JWT, administrator, and local API secrets;
  adopt and safely rotate an existing local SigNoz installation where needed.
- Start SigNoz, Blnk, PostgreSQL, API, worker, and Web through health-gated
  Compose models, then validate the exact running image digests, MCP, OTLP, and
  every user-facing endpoint.
- Run Foundry's complete generated collector pipeline in supported static-config
  mode. Its generated OpAMP manager creates a new unbound agent identity after
  container recreation, which leaves OTLP unusable until a human assigns an
  organization; deterministic local and CI startup must not have that hidden
  UI dependency.
- Keep teardown non-destructive and make status/readiness independently
  inspectable.

Affected files are the demo environment contract, configuration validator,
bootstrap/status/down scripts, API configuration and GitHub client, PostgreSQL
driver, GreenLight and SigNoz Compose overrides, CI/acceptance gates, and
operator documentation. The only database topology change is replacing the
shared local SQLite file with the existing PostgreSQL adapter and a dedicated
persistent local volume.

### Testing, security, operations, and rollback

Configuration tests cover malformed and duplicate keys, shell-safe values,
placeholder credentials, optional anonymous GitHub access, migration of legacy
settings, strong private secret generation, and idempotency. API regression
tests cover anonymous public-repository requests and a failed PostgreSQL ping.
Shell syntax, Compose normalization, build, lint, typecheck, unit/integration
tests, image runtime identity, and live dependency health are blocking gates.

Secrets are never printed or checked in, local listeners remain loopback-only,
runtime containers use read-only filesystems where practical, and PostgreSQL is
not published to the host. The API pool logs a sanitized error code instead of
crashing or exposing a connection string. `npm run demo:down` is the rollback:
it stops only this stack and preserves all volumes; the previous application
commit can then be started against the same additive schema.

### Validation evidence

- Missing `.env.demo` failed before startup with one exact copy/configure/rerun
  action; a missing service-account key stopped after SigNoz provisioning and
  before GreenLight startup with one exact UI remediation.
- A complete rerun verified Node `v24.14.0`, npm `11.7.0`, Docker `29.6.1`,
  Foundry `v0.2.16`, the Blnk tag/SHA/patch, all six SigNoz image digests, and
  every health endpoint.
- Blnk source/seed state was reused idempotently; PostgreSQL, API, worker, and
  Web started in health order. API/worker run as non-root UID `65532`, Web as
  UID `101`, and application filesystems are read-only.
- `/api/v1/status/dependencies` reported database, GitHub, and SigNoz healthy.
  A real PostgreSQL outage changed `/readyz` from HTTP 200 to HTTP 503 with
  `database=failed`; recovery restored HTTP 200 without restarting the API.
- The live SigNoz API credential was accepted and stored only in ignored
  mode-0600 local configuration. A full stop/start preserved all volumes, and
  the static collector recovered without a new organization assignment; OTLP
  and MCP runtime verification passed.

## H-06 — Clean production dependency and image supply chain

### Judging impact and root cause

The audit observed two high-severity findings after a production prune, so the
project could not substantiate its security posture. Investigation found three
separate causes: the Web shipped a full routing framework for three static
routes even though no published React Router release was free of the current
advisory; API/worker images pruned the entire monorepo and therefore retained
unrelated workspace packages; and year-old Node/Nginx bases carried fixable OS
and bundled-tool vulnerabilities. The private workspace root also lacked a
version, causing npm's CycloneDX generator to reject the package URL.

### Implementation plan and architecture

- Replace the three-route client router with an exact, unit-tested pathname
  matcher and retain normal links, browser history, deep links, and the Nginx
  SPA fallback without a framework-sized dependency.
- Install production dependencies for only `@greenlight/api` and
  `@greenlight/shared`; keep the MCP SDK exact-pinned as a development-only
  acceptance client.
- Build on the current Node 24 LTS security release, then copy the runtime into
  Google's digest-pinned non-root Distroless Node 24 image. Serve the Web from
  the current digest-pinned Nginx stable slim unprivileged image.
- Generate a production-only CycloneDX SBOM and make full-tree high findings,
  any production finding, runtime dependency leakage, non-root identity, and
  every image high/critical finding blocking CI gates.

Affected files are the Web route boundary and its callers, workspace manifests
and lockfile, API/worker/Web Dockerfiles, local Compose command/health
contracts, the runtime image validator, and the CI security/image jobs. There
is no database migration or new infrastructure service.

### Testing, security, operations, and rollback

Route tests cover the list aliases, case-normalized exact 40-character receipt
SHA, and not-found paths. The image contract executes inside API and worker
images to prove required packages resolve while React, routing, MCP,
TypeScript, Vitest, shells, and package managers do not. CI emits a
production-only CycloneDX artifact and scans all three release images with the
post-incident Trivy action pinned to an exact commit.

All runtime bases are immutable manifest digests. API/worker contain 13
Distroless Debian packages, run as UID `65532`, have no shell or package
manager, and remain compatible with read-only filesystems. Web uses Nginx
`1.30.4` stable after its July 2026 security fixes and runs as UID `101`.
Rollback redeploys the previous image digests and restores the prior route
implementation; the added root package version and production SBOM metadata
are backward-compatible and need no rollback.

### Validation evidence

- `npm audit --audit-level=high` passed; only two moderate development-only
  MCP/Hono findings remain. `npm audit --omit=dev --audit-level=low` reported
  zero production vulnerabilities.
- `npm sbom --omit=dev --sbom-format=cyclonedx` emitted CycloneDX 1.5 with 118
  components and no React Router or MCP SDK.
- A newly published `brace-expansion` advisory made Vitest 3's coverage chain
  fail the full-tree gate during final validation. Vitest and its coverage
  provider were upgraded together to exact `4.1.10`; the full suite and
  coverage gate passed after the major upgrade.
- API, worker, and Web production builds completed; scoped runtime installs
  each reported zero npm vulnerabilities.
- `scripts/runtime-image-contract.sh` verified non-root UIDs, required runtime
  modules, excluded development packages, and the shell/package-manager-free
  Distroless boundary.
- Trivy `v0.70.0` at
  `sha256:be1190afcb28352bfddc4ddeb71470835d16462af68d310f9f4bca710961a41e`
  scanned exported archives without Docker-socket access. API, worker, and Web
  each reported zero high/critical findings, including unfixed findings.
- The first Compose rollout exposed an incompatible `command: ["node", ...]`
  override; container logs identified `/app/node`, the command and health
  contract were corrected, and an idempotent rerun restored every service.
  The final API, worker, Web, Blnk, MCP, and SigNoz health checks passed.
- Four authenticated live SigNoz integration tests passed, including OTLP
  export and API verification of a four-span reconstructed CI tree. The smoke
  path also accepted final-lockfile trace
  `f18b54a4ba85c67aed77334c193c369d`.

## H-07 — Receipt correctness and persisted CI details

### Judging impact and root cause

The hero artifact returned `200 null` for an unknown commit because the route
tested a Promise before awaiting it. CI duration and slowest step were computed
from the GitHub response, then discarded before persistence; a later receipt
therefore had no source from which to recover them.

### Implementation plan and architecture

- Await the receipt service before selecting the HTTP response.
- Add nullable `duration_ms` and `slowest_step` fields to both SQLite and
  PostgreSQL through one forward-only migration per dialect.
- Compute both values once in the existing GitHub normalization flow, persist
  them on the pipeline row, and render the stored values in the receipt.
- Retain the in-memory normalized-run fallback for callers that assemble a
  receipt before persistence.

Affected components: API route, GitHub sync, repository row/SQL, receipt
assembler, SQLite/PostgreSQL migrations, compiled migration smoke, API tests.
No infrastructure service changes are required.

### Testing, security, operations, and rollback

- HTTP boundary test proves an unknown valid SHA returns typed 404.
- GitHub sync test proves fixture timing and slowest step are persisted.
- Repository test proves the fields survive a database round trip.
- Receipt test proves the fields reach the shared API contract.
- API typecheck, lint, build, and compiled migration smoke are required.

The fields contain GitHub workflow metadata already visible through the
configured repository; no new secret or user content is stored. They are
nullable for backward compatibility. Rollback deploys the prior application
while leaving additive columns in place for forward repair; no destructive
down migration is used.

### Validation evidence

- `npm --workspace @greenlight/api test -- --run test/assembler.test.ts test/github-sync.test.ts test/server-boundaries.test.ts test/db.test.ts`
  — 17 tests passed.
- `npm --workspace @greenlight/api run typecheck` — passed.
- `npm run lint` — passed.
- `npm run build` — passed.
- `npm run test:compiled-migrations` — applied migrations 001–004.

Live SigNoz is not involved in this correctness unit. The later H-01 rehearsal
will verify that the persisted CI trace and displayed timing refer to the same
live run.

## H-08 — True error-rate alert

### Judging impact and root cause

The rule named “candidate error rate regression” selected a single `count()`
query over every matching span. It would fire when traffic exceeded five spans,
regardless of whether any request failed. This creates false incidents and
undermines the central SigNoz claim.

### Implementation plan and architecture

- Follow the official Query Builder v5 alert model: query A counts errored
  spans, query B counts all spans over the identical service/version/
  environment/route scope, and formula F1 computes `A/B*100`.
- Evaluate F1 against the same 6% absolute guardrail used by the GreenLight
  default regression policy, with percent as the threshold unit.
- Mark both alert assets as Query Builder `v5`.
- Export the asset validators for unit testing and add semantic validation
  specific to the error-rate asset so a structurally valid count rule cannot
  be mislabeled as a rate later.

Affected components: SigNoz alert assets, asset validator, root test command,
and the remediation tracker. No database or application runtime changes are
required.

### Testing, security, operations, and rollback

- Asset validation must accept the production rule.
- Negative tests remove the denominator/formula and mismatch the two scopes;
  both must fail.
- The alert importer remains the authoritative live API gate.
- Notification channels stay environment-provided and are never committed.

Rollback deletes/reimports the prior rule through the idempotent importer. The
old count rule must not be restored under an “error rate” name; if formula
support is unavailable, use an explicitly named error-count rule instead.

### Validation evidence

- `node --test scripts/signoz-assets.test.mjs` — semantic positive and negative
  tests pass.
- `npm run validate:signoz-assets` — three dashboards and two v5 alert rules
  pass structural and semantic validation.
- `npm run lint` — passed.

Live import, generated failing/recovery traffic, notification delivery, and
alert resolution remain part of H-04/H-09/H-01 because they require the pinned
SigNoz stack and a configured local notification receiver.

## H-09 — Visible compatible SigNoz dashboards

### Judging impact and root cause

The three committed dashboards imported successfully through the API but did
not render. Two independent defects were responsible.

First, SigNoz `v0.134.0` stores dashboards in the v5 resource model yet its
panel renderer still reads group-by fields through the legacy attribute keys
(`key`/`dataType`/`type`). A widget carrying only the v5 keys
(`name`/`fieldDataType`/`fieldContext`) saved cleanly and answered API queries,
but the browser sent an empty group-by key and every grouped panel failed with
`invalid query 'A': invalid empty key name for group by at index 0`. The
importer had missed this because it built its own request from the widget
instead of reproducing what the renderer sends.

Second, the `http.route` attribute was never recorded on GreenLight API spans,
so "API requests by route" grouped all traffic into one empty series. The
process registered `@opentelemetry/instrumentation-fastify`, but that package
patches CommonJS `require`; the API is ESM, so an `import` of Fastify was never
wrapped and every span was named `GET` with no route. Because both the HTTP
server span and the Fastify spans matched the panel filters, the request,
latency, and error panels also counted three spans per request.

### Implementation plan and architecture

- Emit both key sets from the dashboard compiler so the stored dashboard stays
  v5-native and renderable, deriving the legacy fields from the v5 ones rather
  than duplicating them in the source definitions.
- Rebuild the group-by in the importer's live check exactly as the renderer
  does, so the check fails on the same input the browser fails on.
- Replace the ineffective instrumentation with `@fastify/otel`, Fastify's
  official plugin, registered explicitly in `buildServer`. Explicit
  registration is deterministic and needs no ESM loader hook.
- Skip readiness probes and per-hook spans so trace volume stays proportional
  to real traffic.
- Scope the API request/latency/error panels to `kind_string = 'Server'` so one
  request contributes exactly one span.

Affected components: dashboard compiler and importer, the three dashboard
definitions, API telemetry bootstrap and server construction, and API
dependencies. No database or infrastructure change is required.

### Testing, security, operations, and rollback

Unit tests assert that compiled group-by fields carry matching legacy and v5
keys, and that a v5-only group-by renders as the empty key SigNoz rejects.
Route-attribution tests assert the request span carries the matched route, that
the parameterised route reports `/api/v1/changes/:commitSha` rather than a
per-commit path that would explode dashboard cardinality, and that readiness
probes are not traced.

The importer is idempotent and updates by title, so dashboard IDs already
published in receipts and demo documentation survive re-import. No credential
is committed; the importer reads `SIGNOZ_API_KEY` from the environment.

Rollback reverts the commit and re-runs `npm run signoz:import`; the dashboard
IDs are preserved either way. Reverting the telemetry change restores the prior
uninstrumented span names without affecting request handling.

### Validation evidence

- All three dashboards import with stable IDs and 14 panels; every panel is
  executed through Query Builder v5 with no result-level error.
- Browser verification at `v0.134.0`: all panels on all three dashboards render
  with no error icon, and every `POST /api/v5/query_range` returns 200. Before
  the fix the same page produced nine 400 responses.
- The two temporary schema-probe dashboards created during investigation were
  deleted; only the three GreenLight dashboards remain.
- Live SigNoz confirms route attribution: `GET /api/v1/changes`,
  `GET /api/v1/changes/:commitSha`, and `GET /api/v1/status/dependencies` each
  carry the matching `http.route`, and `kind_string = 'Server'` isolates one
  span per request.
- `npm run verify` (147 tests), `npm run lint`, `npm run quality`, and
  `npm audit --omit=dev` passed.

### Remaining limitations

Running both the HTTP instrumentation and `@fastify/otel` records three spans
per request: the HTTP server span, the plugin's `request` span, and the route
handler span. This is inherent to the supported combination — the HTTP
instrumentation is still required for outbound GitHub and SigNoz client spans.
Dashboard panels filter on `kind_string` so counts and percentiles are correct;
the extra internal spans remain visible in trace detail views.

Pipeline-health panels render but return no data until H-01 produces a real CI
evidence chain for the `greenlight-ci` service.

## H-10 — Judge landing state

### Judging impact and root cause

The root route rendered the change list, and a fresh install has no changes, so
the first screen a judge saw was the single sentence "No changes recorded yet."
It stated no promise, showed no readiness, offered no next action, and gave no
way to reach the one thing worth looking at. The empty, degraded, and populated
paths were all equally uninformative because the list view had nothing to say
about any of them.

### Implementation plan and architecture

- Serve a landing page at `/` and move the change list to `/changes`.
- State the product promise in one sentence above the fold.
- Read `GET /api/v1/status/dependencies` and show each dependency's state with
  the exact command that fixes it when degraded.
- Offer the demo receipt only when a chain is genuinely complete, and otherwise
  say so and print the command that produces one.
- Give the change list's empty and error states the same runnable next action
  and a route back to the overview.

`selectFeaturedChange` is deliberately conservative: a chain counts as complete
only when the AI session is `verified`, a CI conclusion exists, a deployment
exists, and the regression verdict is one of `healthy`/`regressed`/`recovered`.
`insufficient_data` and `integration_error` are evaluations that did not reach
a verdict, so they do not qualify. A recovered regression outranks a change
that merely stayed healthy because it demonstrates the whole product in one
receipt.

Affected components: shared contracts and schemas (`DependencyStatus`), web API
client, a new landing feature, route table, and the change list. No database,
API, or infrastructure change is required.

### Testing, security, operations, and rollback

The API answers 503 with a complete body when a dependency is down. The client
reads that status as data rather than an error, because treating it as a
failure would hide precisely what the page exists to show; transport and
contract failures still propagate. Component tests cover the verified,
empty-install, degraded, and API-unreachable paths, and assert that a degraded
dependency is named in text rather than by colour alone.

No credential reaches the browser: reads use the browser's own session, and the
SigNoz link is a build-time public URL.

Rollback reverts the commit; `/` returns to the change list and no persisted
state is involved.

### Validation evidence

- `npm run verify` (147 tests, 23 of them web), `npm run lint`, and
  `npm run quality` passed.
- Browser evidence: `audit/screenshots/08-landing.png` — promise, three
  healthy dependencies, the honest "no changes recorded yet" path with
  `npm run demo:rehearse`, and navigation to the list and SigNoz.
- `npm run demo:rehearse` was added so the command the UI prints is real.

### Remaining limitations

`VITE_SIGNOZ_URL` and `VITE_API_BASE` are inlined at build time and default to
the documented loopback ports. A deployment that publishes different hostnames
must rebuild the web image with those values set.

## H-16 — Verdict-first receipt and semantic change list

### Judging impact and root cause

The receipt opened with the AI-link state and an evidence timeline, and reached
the regression verdict only after CI and deployment detail. A reader had to
assemble the answer from implementation detail instead of being told it. On the
change list, all four badges rendered in the same neutral grey with raw enum
values, so a regressed change and a healthy one looked identical and neither
badge said what it meant.

### Implementation plan and architecture

- Add one module, `apps/web/src/status.ts`, that maps every regression status,
  verification state, CI conclusion, and deployment status to a label, a tone,
  and a plain-language meaning. Every badge in the product resolves through it,
  so a colour cannot mean one thing on the list and another on a receipt.
- Lead the receipt with a verdict banner: the decision as the largest element,
  its meaning in a sentence, and the two deltas the decision rests on with
  their percentage change.
- Reorder the receipt to verdict → recovery → impact → evidence timeline → CI →
  deployment → evidence links → actions → caveat.
- Colour the list badges by tone, lead with the verdict, and attach each
  badge's meaning as both a `title` and screen-reader text.

Unknown CI conclusions stay neutral rather than being guessed into a pass or a
failure, because GitHub's conclusion field is open-ended.

Affected components: web status module, receipt page, new verdict banner, and
the change list. No API, contract, database, or infrastructure change.

### Testing, security, operations, and rollback

Tests assert that the verdict heading is the first `h2` on the receipt, that
both deltas render with their percentage change, that a missing measurement
reads "not measured" rather than implying no movement, and that
`integration_error` is never presented as a passing verdict. List tests assert
that regressed and healthy badges differ in tone, that every badge carries a
written meaning rather than colour alone, and that an unrecognised CI
conclusion stays neutral.

`percentChange` returns null when the baseline is zero, because a percentage
change from zero is undefined; rendering "Infinity%" beside a verdict would be
worse than saying nothing.

Rollback reverts the commit. No persisted state or contract is involved.

### Validation evidence

- `npm run verify` (33 web tests, 166 total), `npm run lint`, and
  `npm run quality` passed.
- A populated receipt screenshot is captured under H-01, which produces the
  first real evidence chain; seeding one here would have meant screenshotting
  fabricated data.
