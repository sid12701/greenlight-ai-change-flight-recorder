# GreenLight Implementation Tracker

Last updated: 2026-07-24

> Historical planning record. “done” below means the original issue/PR was merged;
> it does not mean the audited evidence or production acceptance criterion passed.
> The authoritative current status is
> [`docs/REMEDIATION_TRACKER.md`](REMEDIATION_TRACKER.md).

## Status overview

| Issue | Status | Notes |
|---|---|---|
| GL-P0-T01 | done | Merged on `main` (`96c1eed`) |
| GL-P0-T02 | done | Merged on `main` (`d057a11`) |
| GL-P1-T01 | done | PR #33 merged |
| GL-P1-T02 | done | PR #34 merged |
| GL-P1-T03 | done | PR #35 merged |
| GL-P2-T01 | done | PR #36 merged |
| GL-P2-T02 | done | PR #37 merged |
| GL-P2-T03 | done | PR #38 merged |
| GL-P2-T04 | done (fixture) | PR #39 merged; **live trace-linked commit evidence pending** |
| GL-P3-T01 | done | PR #40 merged |
| GL-P3-T02 | done | PR #41 merged |
| GL-P3-T03 | done | PR #42 merged |
| GL-P3-T04 | done | PR #43 merged |
| GL-P3-T05 | done | PR #44 merged |
| GL-P4-T01 | done | PR #45 merged |
| GL-P4-T02 | done | PR #46 merged |
| GL-P4-T03 | done | PR #47 merged |
| GL-P4-T04 | done | PR #48 merged |
| GL-P4-T05 | done | PR #49 merged — recovery resolver wired in this pass |
| GL-P4-T06 | done | PR #50 merged |
| GL-P5-T01 | done | PR #51 merged |
| GL-P5-T02 | done | PR #52 merged |
| GL-P5-T03 | done | PR #53 merged |
| GL-P5-T04 | done | PR #54 merged |
| GL-P5-T05 | done | PR #55 merged |
| GL-P6-T01 | done | PR #57 merged |
| GL-P6-T02 | done | PR #58 merged |
| GL-P6-T03 | done | PR #59 merged |
| GL-P7-T01 | done (script) | PR #60 merged; **live MCP fixture pending** |
| GL-P7-T02 | partial | PR #61 merged (docs); submission/rehearsal/recording not performed |

## Remaining engineering (this pass)

| Work item | Status |
|---|---|
| GitHub sync routes (`sync-runs`, `sync-latest`) | done |
| Recovery evaluation path (`comparisonKind=recovery`) | done |
| `evidence_links` persistence + receipt assembly | done |
| SigNoz query completeness (request count, error rate, slow traces) | done |
| Repo CI workflow (`.github/workflows/ci.yml`) | done |
| Optional Playwright smoke (`e2e-smoke.yml`) | done |
| Live trace-linked commit evidence | done (`ea45b32…` on `gl-proof-evidence`) |
| Live MCP investigation fixture | done (`test/fixtures/signoz/mcp-investigation.json`) |
| Full demo rehearsal capture | partial (baseline + smoke; regression/recovery pending `BAD_SHA`) |

## Historical validation claims

- `npm run verify` — passed before the deep audit; it did not include the compiled
  start, blocking browser, integration, security, image, backup, or rollback gates
- `bash scripts/signoz-smoke.sh` — passing after bootstrap
- `integrations/lms/deploy.sh` + `verify.sh` — passing when chained

## Notes

- All 30 GitHub issues closed via one PR per issue (PRs #33–#62).
- SigNoz first-time setup requires `scripts/signoz-bootstrap.sh` before OTLP ingestion works.
- Port 8080 must be free for SigNoz; LMS uses 8081.
- Hackathon submission packaging (recording, `SUBMISSION_CHECKLIST.md`) intentionally deferred.
