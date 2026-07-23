# GreenLight — AI Change Flight Recorder

GreenLight connects an AI coding session to the Git commit it produced, the CI run that validated it, the deployed application version, the resulting SigNoz telemetry, and the evidence that the application recovered.

This repository is the new hackathon project. The pre-existing Bhawana LMS is used only as a monitored demo workload.

## Track

GreenLight is filed under **Track 3 — Build Your Own** because it instruments an otherwise unobserved surface: the AI-authored software-delivery lifecycle, rather than the application or coding agent in isolation. It is inspired by the deployment-guardian problem described in [SigNoz issue #11657](https://github.com/SigNoz/signoz/issues/11657).

The Track 3 path requires GL-P7-T01's fixed SigNoz MCP investigation. If the schedule forces that P1 task to be cut, the remaining product is submitted only to Track 1; the repository must not claim Track 3 without the MCP demonstration.

## Status

GreenLight implementation is complete for local development and demo rehearsal. The monorepo includes:

- SigNoz Foundry stack (`casting.yaml`, smoke scripts)
- LMS deploy/verify/load tooling (`integrations/lms/`)
- GreenLight API + Web (`apps/api`, `apps/web`)
- Demo scripts (`scripts/demo-*.sh`)

Quick start:

```bash
npm install
npm run verify
bash scripts/signoz-bootstrap.sh   # first SigNoz setup only
bash scripts/signoz-smoke.sh
export LMS_PATH=/path/to/lms-greenlight-demo
bash scripts/preflight.sh
```

See [docs/DEMO_STATE.md](docs/DEMO_STATE.md) and [docs/TELEMETRY_CONTRACT.md](docs/TELEMETRY_CONTRACT.md).

## Core evidence chain

```text
Claude Code trace
  → AI-Traceparent Git trailer
  → reconstructed GitHub Actions trace
  → LMS deployment with service.version=<SHA>
  → SigNoz regression evidence
  → GreenLight Change Receipt
  → recovery proof
```

## AI assistance disclosure

Planning and implementation may use Codex/ChatGPT, Claude Code, Cursor, or other AI assistants. AI systems are tools, not repository authors or commit co-authors. All commits are reviewed and authored under the human maintainer's verified Git identity. See [PROVENANCE.md](PROVENANCE.md).

## License

MIT. See [LICENSE](LICENSE).
