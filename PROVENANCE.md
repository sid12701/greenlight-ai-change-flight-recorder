# Provenance

## Pre-existing work

- Blnk and its existing financial-ledger functionality, fetched from the public
  `blnkfinance/blnk` repository at Apache-2.0 release `v0.15.1`, commit
  `c8fce93af4df6b1edb46ca97e570c55beff4cef9`.
- Any generic test harness or reusable tool created before the hackathon must be listed here only after its actual creation date is verified.

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

## GL-P2-T04 trace-linked commit

The immutable GreenLight proof commit for Claude→CI linkage will be documented
in `docs/EVIDENCE_LOG.md`. Until the manual Claude Code capture is performed in
the public submission repository, status remains `pending_manual_capture`.

## AI assistance

AI assistants may support research, planning, coding, review, and test generation. Their use is disclosed here and in the submission. AI assistants are not added as Git commit co-authors. The human maintainer reviews and accepts responsibility for every committed change.

## Data

Only synthetic Blnk data may be used in telemetry, screenshots, recordings,
fixtures, and demonstrations. No real borrower, identity, banking, payment,
prompt, transcript, or credential data may be committed or displayed.
