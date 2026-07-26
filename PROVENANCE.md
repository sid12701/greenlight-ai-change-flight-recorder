# Provenance

## Pre-existing work

- Blnk and its existing financial-ledger functionality, fetched from the public
  `blnkfinance/blnk` repository at Apache-2.0 release `v0.15.1`, commit
  `c8fce93af4df6b1edb46ca97e570c55beff4cef9`.
Blnk is a monitored third-party workload. It is not presented as
hackathon-built GreenLight functionality. Selection, reproducible integration,
hardening, synthetic seed/load tooling, and SigNoz wiring are GreenLight work.

## Hackathon work

The following are GreenLight work:

- Claude-to-commit trace bridge.
- Shared W3C trace-context validation.
- GitHub Actions run reconstruction as explicitly labeled OpenTelemetry spans.
- Primary backend-workflow selection and cross-trace linking.
- Deployment/version correlation.
- SigNoz queries, dashboards, alerts, and MCP investigation.
- Regression and recovery evaluation.
- Change Receipt API and web interface.
- Demo automation, soft reset, and reproducibility documentation.

## Claude-to-commit linkage

No commit in the recorded chain carries a resolvable Claude Code session span,
because the recorded commits were not authored in a session exporting telemetry
to SigNoz. Receipts report that link as `missing` rather than implying one.
[`docs/AI_LINK.md`](docs/AI_LINK.md) is the procedure for producing a verified
link, and `npm run ai-link:verify` reports which of the four links is unarmed.

## AI assistance

AI assistants may support research, planning, coding, review, and test generation. Their use is disclosed here and in the submission. AI assistants are not added as Git commit co-authors. The human maintainer reviews and accepts responsibility for every committed change.

## Data

Only synthetic Blnk data may be used in telemetry, screenshots, recordings,
fixtures, and demonstrations. No real borrower, identity, banking, payment,
prompt, transcript, or credential data may be committed or displayed.
