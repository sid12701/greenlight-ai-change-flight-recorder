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
| H-03 | P0 | Public reproducible LMS/loan workload | planned | Clean-machine pinned checkout/container, health, seed, failure and recovery |
| H-04 | P0 | Digest-pinned compatible Foundry stack | planned | Fresh gauge/forge/cast/smoke/import/MCP pass |
| H-05 | P0 | Actionable clean demo bootstrap | planned | One documented command succeeds or fails before startup with precise remediation |
| H-06 | P0 | Production dependency vulnerabilities | planned | npm audit, SBOM and image scan have no blocking high/critical findings |
| H-07 | P0 | Receipt 404 and persisted CI details | validated | Unknown SHA is 404; duration/slowest step survive database round trip |
| H-08 | P0 | Correct, live-tested error-rate alert | planned | True rate query fires and resolves against generated traffic |
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
