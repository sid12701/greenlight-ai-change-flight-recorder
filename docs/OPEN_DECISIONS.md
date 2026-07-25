# Open Decisions

## Resolved public workload dependency

| Decision | Resolution |
|---|---|
| Public workload | `blnkfinance/blnk` |
| Frozen release | `v0.15.1` / `c8fce93af4df6b1edb46ca97e570c55beff4cef9` |
| Licence | Apache-2.0 |
| Local source boundary | Ignored `.workloads/blnk`; exact origin/SHA/patch verified by `integrations/blnk/fetch.sh` |
| Runtime dependencies | PostgreSQL 16 + Redis 7; Typesense and vendor telemetry disabled |
| Synthetic demo workflow | Seeded loan ledger, authenticated healthy traffic, reversible database outage, recovery |

## Still open

| Decision/check | Deadline | Resolution rule |
|---|---|---|
| Exact verified Claude Code version | Phase 2 start | Pin output of `claude --version` after trace propagation is proven |
| Actual SigNoz route/status/database attribute keys | Phase 1 | Record keys observed in a real versioned trace |
| Claude-to-CI clickable linkage | July 24, 2026, 18:00 IST | Freeze session-ID fallback if beta linkage is not green |
| Error-rate demo band | Resolved | The real local dependency-outage run produced 40 HTTP 500 spans and 6.02% error spans across the bounded H-03 validation set |

Decisions must be recorded in the relevant issue and reflected in the authoritative implementation plan when they change a contract.
