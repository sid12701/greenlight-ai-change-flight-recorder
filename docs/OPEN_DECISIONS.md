# Open Decisions

No product decision currently blocks repository initialization.

The following implementation-time checks must be resolved through evidence rather than assumption:

| Decision/check | Deadline | Resolution rule |
|---|---|---|
| Exact verified Claude Code version | Phase 2 start | Pin output of `claude --version` after trace propagation is proven |
| Minimal LMS infrastructure services | Phase 1 | Start only dependencies actually used by `/home/overview` |
| Actual SigNoz route/status/JDBC attribute keys | Phase 1 | Record keys observed in a real versioned trace |
| Claude-to-CI clickable linkage | July 24, 2026, 18:00 IST | Freeze session-ID fallback if beta linkage is not green |
| Error-rate demo band | Phase 6, 30-minute time box | Use latency-only framing if 5–15% errors are not repeatable |
| LMS demo branch access for judges | Phase 0 | Publish sanitized branch or provide the one-hour minimal fixture |

Decisions must be recorded in the relevant issue and reflected in the authoritative implementation plan when they change a contract.
