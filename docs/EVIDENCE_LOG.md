# GreenLight evidence log

Record sanitized rehearsal outputs here. Do not paste secrets, prompts, or borrower data.

## 2026-07-25 — reproducible demo bootstrap and dependency failure

**Classification:** live local bootstrap, runtime, and failure/recovery evidence.

- **First-run behavior:** missing `.env.demo` failed before startup with one
  copy/configure/rerun action. Missing SigNoz service-account credentials
  stopped before GreenLight startup with one precise UI remediation.
- **Toolchain:** Node `v24.14.0`, npm `11.7.0`, Docker `29.6.1`, Compose v2,
  Foundry `v0.2.16`.
- **Topology:** digest-pinned SigNoz and MCP; exact public Blnk `v0.15.1`;
  dedicated GreenLight PostgreSQL; API, worker, and Web in health-gated
  containers. The complete Foundry-generated collector pipeline runs in
  deterministic static-config mode so restarts do not create an unbound random
  OpAMP agent. All host listeners are loopback-only.
- **Security:** generated secrets and the user-created service-account key are
  in ignored mode-0600 files. API/worker run as `node`, Web as UID `101`, and
  all three application filesystems are read-only.
- **Health:** GreenLight dependency status reported PostgreSQL, public GitHub,
  and SigNoz healthy. SigNoz image-digest, API-version, MCP-liveness, and OTLP
  ingestion checks passed.
- **SigNoz read-back:** all four authenticated live integration tests passed,
  including reconstruction, OTLP export, and API verification of a CI span
  tree. A separately exported backdated smoke trace resolved with one span.
- **Failure drill:** stopping only GreenLight PostgreSQL produced HTTP `503`
  from `/readyz` with `{"database":"failed"}`. Restarting PostgreSQL restored
  HTTP `200` with `{"database":"ok"}`; API restart count remained zero.
- **Idempotency:** rerunning `npm run demo:up` reused the exact Blnk checkout,
  seed ledger, persistent databases, and existing images while reconciling
  health.

## 2026-07-25 — pinned SigNoz Foundry runtime

**Classification:** live local runtime and immutable-image evidence.

- **Foundry CLI:** `v0.2.16`; `gauge` and `forge` completed successfully.
- **Runtime matrix:** SigNoz `v0.134.0`, collector `v0.144.6`, MCP `v0.9.0`,
  PostgreSQL `16.14-trixie`, ClickHouse server/Keeper `25.12.5`.
- **Immutability:** each of the six running containers matched its committed
  `repository@sha256` manifest digest.
- **Health:** SigNoz version API and MCP livez responded; PostgreSQL,
  ClickHouse, and Keeper were healthy.
- **Ingestion:** a fresh OTLP/HTTP span was accepted after runtime validation.
- **Configuration:** generated Compose plus the safety override resolved only
  digest references and passed `docker compose config --quiet`.
- **Credential rotation:** the old local service-account key now returns 401
  after enabling the required tokenizer JWT secret. Existing imported assets
  remain; a replacement key is required for the next import/read-back.

## 2026-07-25 — public Blnk workload acceptance

**Classification:** live local runtime and SigNoz evidence.

- **Repository:** `https://github.com/blnkfinance/blnk.git`
- **Release/SHA:** `v0.15.1` /
  `c8fce93af4df6b1edb46ca97e570c55beff4cef9`
- **Runtime:** non-root UID/GID `10001`, read-only filesystem, PostgreSQL and
  Redis internal-only, generated local authentication key.
- **Seed:** one synthetic loan ledger and two synthetic USD balances.
- **Traffic:** 120 healthy requests, 40 harmless 404 requests, 60 recovery
  requests, then a real database-outage cycle with 40 HTTP 500 requests and 60
  successful post-recovery requests.
- **SigNoz result:** `698` spans / `374` traces for
  `service.name=blnk-loan-workload` and the exact release SHA; `42` error spans
  (`40` `/balances` 500 spans plus `2` `/health` 503 spans), `6.02%` of spans in
  the observed validation set.
- **Final state:** Blnk API, PostgreSQL, and Redis healthy; worker running.
- **Commands:** `integrations/blnk/up.sh`,
  `integrations/blnk/failure-cycle.sh`, source verifier, contract tests,
  Compose config validation, and read-only operator aggregation in the local
  SigNoz trace store.

The sections below are retained as historical audit context for the superseded
private LMS integration and are not the current demo path.

## Phase 1 — LMS baseline trace

**Classification:** offline diagnostic only; not production acceptance evidence.

- **SHA:** `2269d064f0be50e7f6485c0be38e3cdcef6137d2`
- **Route:** `GET /api/v1/internal/home/overview`
- **Verification:** `integrations/lms/verify.sh`
- **Observed keys:** documented in `docs/TELEMETRY_CONTRACT.md`
- **2026-07-24 rehearsal:** 3115 traces, 1959 JDBC child spans in ClickHouse

## Phase 1 — SigNoz backdated span

**Classification:** synthetic OTLP transport smoke test, not a Claude Code trace.

- **Script:** `scripts/backdated-span-smoke.mjs`
- **Evidence:** ClickHouse `signoz_traces.distributed_signoz_index_v3` trace lookup
- **2026-07-24 traceId:** `7b5b1b39741a991f073d59e245fb7575`

## Phase 2 — Trace-linked LMS commit (GL-P2-T04)

**Verification status:** invalid/unverified for the headline chain. The trace ID belongs
to the synthetic backdated smoke span and the documented parent span
`00f067aa0ba902b7` was not resolved in SigNoz. This record must not be presented as
Claude provenance.

- **Branch:** `gl-proof-evidence` (isolated from frozen `greenlight-demo` baseline)
- **Commit:** `ea45b32e528e9be2e993bc4a46b4871d4752c038`
- **AI-Traceparent:** `00-7b5b1b39741a991f073d59e245fb7575-00f067aa0ba902b7-01`
- **SigNoz lookup:** http://localhost:8080/trace/7b5b1b39741a991f073d59e245fb7575
- **Verification:** `bash scripts/verify-trace-linked-commit.sh /Users/siddhant/Desktop/lms-greenlight-demo ea45b32e528e9be2e993bc4a46b4871d4752c038`

## Phase 6 — Regression / recovery

**Verification status:** historical rehearsal only. These evaluations were created by
the pre-remediation implementation, which widened windows, used direct ClickHouse
fallbacks, recomputed the recovery baseline, and rendered a default threshold of 200
while the process ran with `GREENLIGHT_MIN_SPANS=90`. They do not satisfy the current
acceptance gate.

- **BAD_SHA:** `c6618e1621ebc1765564446bac68f71293eb79be` (fixed-count `countByStatus` loop — ~1s p95 on home overview)
- **Baseline SHA:** `2269d064f0be50e7f6485c0be38e3cdcef6137d2`
- **Script:** `scripts/demo-full-rehearsal.sh` (baseline load → regression → recovery)
- **2026-07-24 regression evaluation:** `eval_dep_c6618e1621eb_candidate_1784835020332`
  - **status:** `regressed`
  - **baseline p95:** 33.9 ms (254 spans)
  - **observed p95:** 1041.0 ms (209 spans)
  - **latency delta:** +2968%
  - **evidence:** dashboard + 3 slow traces (`cad82166…`, `afce79f8…`, `33dfc7eb…`)
- **2026-07-24 recovery evaluation:** `eval_dep_2269d064f0be_recovery_1784835137946`
  - **status:** `recovered`
  - **baseline p95:** 36.4 ms (254 spans)
  - **observed p95:** 23.6 ms (254 spans)
  - **evidence:** dashboard + 3 traces (`9cbcbd88…`, `f35560a8…`, `24ae247b…`)
- **Note:** `GREENLIGHT_MIN_SPANS=90` used for demo (slow bad build yields fewer HTTP route spans per load window)

## Phase 7 — MCP investigation

**Verification status:** fixture only. The capture path did not establish an official
MCP client network session, and the fixture therefore does not satisfy Track 3.

- **Prompt:** `docs/MCP_DEMO.md`
- **Fixture:** `test/fixtures/signoz/mcp-investigation.json`
- **Validator:** `node scripts/verify-mcp-result.mjs` (passing)
- **Capture script:** `npx tsx scripts/capture-mcp-fixture.mjs`
- **2026-07-24 traceIds:** `d2a01baea9c2d0a4e87c727d6bfbc8b8`, `223a2592ac0dd07124906e6a0b567208`, `69663ed8314b82d546fbb7d00c86c257`

## Phase 7 — Demo rehearsal

**Verification status:** historical and unverified for production acceptance.

- **2026-07-24:** `scripts/demo-smoke.sh`, `scripts/demo-baseline.sh`, `integrations/lms/verify.sh` passed
- **Baseline deployment ID:** `dep_2269d064f0be_baseline`
- **Candidate deployment ID:** `dep_c6618e1621eb_candidate`
- **Recovery deployment ID:** `dep_2269d064f0be_recovery`
- **Load:** 254 requests per phase to `/api/v1/internal/home/overview`
- **Full chain:** `scripts/demo-full-rehearsal.sh` — regression `regressed`, recovery `recovered`
