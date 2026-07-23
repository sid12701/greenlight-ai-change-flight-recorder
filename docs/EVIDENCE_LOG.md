# GreenLight evidence log

Record sanitized rehearsal outputs here. Do not paste secrets, prompts, or borrower data.

## Phase 1 — LMS baseline trace

- **SHA:** `2269d064f0be50e7f6485c0be38e3cdcef6137d2`
- **Route:** `GET /api/v1/internal/home/overview`
- **Verification:** `integrations/lms/verify.sh`
- **Observed keys:** documented in `docs/TELEMETRY_CONTRACT.md`
- **2026-07-24 rehearsal:** 3115 traces, 1959 JDBC child spans in ClickHouse

## Phase 1 — SigNoz backdated span

- **Script:** `scripts/backdated-span-smoke.mjs`
- **Evidence:** ClickHouse `signoz_traces.distributed_signoz_index_v3` trace lookup
- **2026-07-24 traceId:** `7b5b1b39741a991f073d59e245fb7575`

## Phase 2 — Trace-linked LMS commit (GL-P2-T04)

- **Branch:** `gl-proof-evidence` (isolated from frozen `greenlight-demo` baseline)
- **Commit:** `ea45b32e528e9be2e993bc4a46b4871d4752c038`
- **AI-Traceparent:** `00-7b5b1b39741a991f073d59e245fb7575-00f067aa0ba902b7-01`
- **SigNoz lookup:** http://localhost:8080/trace/7b5b1b39741a991f073d59e245fb7575
- **Verification:** `bash scripts/verify-trace-linked-commit.sh /Users/siddhant/Desktop/lms-greenlight-demo ea45b32e528e9be2e993bc4a46b4871d4752c038`

## Phase 6 — Regression / recovery

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

- **Prompt:** `docs/MCP_DEMO.md`
- **Fixture:** `test/fixtures/signoz/mcp-investigation.json`
- **Validator:** `node scripts/verify-mcp-result.mjs` (passing)
- **Capture script:** `npx tsx scripts/capture-mcp-fixture.mjs`
- **2026-07-24 traceIds:** `d2a01baea9c2d0a4e87c727d6bfbc8b8`, `223a2592ac0dd07124906e6a0b567208`, `69663ed8314b82d546fbb7d00c86c257`

## Phase 7 — Demo rehearsal

- **2026-07-24:** `scripts/demo-smoke.sh`, `scripts/demo-baseline.sh`, `integrations/lms/verify.sh` passed
- **Baseline deployment ID:** `dep_2269d064f0be_baseline`
- **Candidate deployment ID:** `dep_c6618e1621eb_candidate`
- **Recovery deployment ID:** `dep_2269d064f0be_recovery`
- **Load:** 254 requests per phase to `/api/v1/internal/home/overview`
- **Full chain:** `scripts/demo-full-rehearsal.sh` — regression `regressed`, recovery `recovered`
