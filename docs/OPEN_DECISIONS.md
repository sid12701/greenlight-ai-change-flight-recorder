# Open Decisions

## Resolved in GL-P0-T02

| Decision | Resolution |
|---|---|
| Isolated LMS demo path | `/Users/siddhant/Desktop/lms-greenlight-demo` |
| Frozen demo baseline SHA | `2269d064f0be50e7f6485c0be38e3cdcef6137d2` (upstream `main` was `bfd571f3…` at isolation time; demo stays pinned to documented baseline) |
| Forbidden `LMS_PATH` | `/Users/siddhant/Desktop/lms` (primary maintainer checkout) |
| Backend CI proof-commit file | `backend/README.md` |
| Minimal infra hypothesis for home overview | PostgreSQL + RabbitMQ required; Redis/MinIO/Mailhog not required by default |

## Still open

| Decision/check | Deadline | Resolution rule |
|---|---|---|
| Exact verified Claude Code version | Phase 2 start | Pin output of `claude --version` after trace propagation is proven |
| Minimal LMS infrastructure services | Phase 1 | Empirically confirm startup with only postgres + rabbitmq |
| Actual SigNoz route/status/JDBC attribute keys | Phase 1 | Record keys observed in a real versioned trace |
| Claude-to-CI clickable linkage | July 24, 2026, 18:00 IST | Freeze session-ID fallback if beta linkage is not green |
| Error-rate demo band | Phase 6, 30-minute time box | Use latency-only framing if 5–15% errors are not repeatable |
| LMS demo branch access for judges | Phase 0 / submission | **Pending:** LMS repo is private; use sanitized branch export or the one-hour minimal HTTP fixture fallback before submission |

Decisions must be recorded in the relevant issue and reflected in the authoritative implementation plan when they change a contract.
