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
| H-05 | P0 | Actionable clean demo bootstrap | planned | One documented command succeeds or fails before startup with precise remediation |
| H-06 | P0 | Production dependency vulnerabilities | planned | npm audit, SBOM and image scan have no blocking high/critical findings |
| H-07 | P0 | Receipt 404 and persisted CI details | validated | Unknown SHA is 404; duration/slowest step survive database round trip |
| H-08 | P0 | Correct, live-tested error-rate alert | validated | True rate query fires and resolves against generated traffic |
| H-09 | P0 | Visible compatible SigNoz dashboards | planned | All panels render in the browser and IDs are recorded |
| H-10 | P0 | Judge landing state | planned | Empty, degraded and verified-demo paths are actionable |
| H-11 | P1 | First-class custom metrics | planned | Metrics for verdicts, verification, queue and dependencies query in SigNoz |
| H-12 | P1 | API log/trace correlation | planned | API and worker logs query by request/job/commit and resolve trace IDs |
| H-13 | P1 | Persisted genuine MCP transcript | planned | Sanitized result and every cited trace resolve |
| H-14 | P1 | SigNoz alert-driven incident flow | planned | Authenticated idempotent webhook creates/updates an incident |
| H-15 | P2 | Meaningful service map | planned | Real topology is visible; omit if it adds no diagnostic value |
| H-16 | P1 | Verdict-first receipt and semantic list | planned | Decision and deltas are first; badges have accessible meaning |
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
