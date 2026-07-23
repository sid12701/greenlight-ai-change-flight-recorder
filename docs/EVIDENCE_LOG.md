# GreenLight evidence log

Record sanitized rehearsal outputs here. Do not paste secrets, prompts, or borrower data.

## Phase 1 — LMS baseline trace

- **SHA:** `2269d064f0be50e7f6485c0be38e3cdcef6137d2`
- **Route:** `GET /api/v1/internal/home/overview`
- **Verification:** `integrations/lms/verify.sh`
- **Observed keys:** documented in `docs/TELEMETRY_CONTRACT.md`

## Phase 1 — SigNoz backdated span

- **Script:** `scripts/backdated-span-smoke.mjs`
- **Evidence:** ClickHouse `signoz_traces.distributed_signoz_index_v3` trace lookup

## Phase 6 — Regression / recovery

- Apply `integrations/lms/patches/regression.patch` in the LMS demo clone
- Record `BAD_SHA` after commit
- Run `scripts/demo-regression.sh` then `scripts/demo-recover.sh`

## Phase 7 — MCP investigation

- Prompt: `docs/MCP_DEMO.md`
- Fixture: `test/fixtures/signoz/mcp-investigation.json` (populate after live MCP run)
