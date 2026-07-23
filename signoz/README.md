# SigNoz local stack (Foundry)

GreenLight uses self-hosted SigNoz as the telemetry system of record. This directory documents the reproducible Foundry installation required by the hackathon.

## Prerequisites

- Docker Desktop (allocate at least 4 GB RAM to Docker)
- [`foundryctl`](https://signoz.io/docs/install/docker/) on your `PATH`
- Port **8080** free for SigNoz UI (LMS demo backend uses **8081**)

## Install and deploy

From the repository root:

```bash
foundryctl gauge -f casting.yaml
foundryctl forge -f casting.yaml
foundryctl cast -f casting.yaml
```

Commit `casting.yaml` and the generated `casting.yaml.lock`. The `pours/` directory is gitignored; regenerate it with `forge`.

## Endpoints

| Service | URL | Purpose |
|---|---|---|
| SigNoz UI | http://localhost:8080 | Traces, dashboards, alerts |
| OTLP HTTP | http://localhost:4318 | Primary ingestion (Claude, GreenLight, LMS) |
| OTLP gRPC | localhost:4317 | Exposed by default; **not required** for GreenLight MVP |
| SigNoz MCP | http://localhost:8000/mcp | Agent-native investigation |
| MCP health | http://localhost:8000/livez | Smoke check |

## Service account API key

1. Open http://localhost:8080 and complete first-time setup.
2. Create a service account with read access for Query Builder and traces.
3. Copy the API key into your local `.env` as `SIGNOZ_API_KEY` (never commit it).

## Smoke tests

```bash
bash scripts/signoz-smoke.sh
node scripts/backdated-span-smoke.mjs
```

`signoz-smoke.sh` checks UI health, MCP livez, and OTLP HTTP export. `backdated-span-smoke.mjs` exports a span timestamped two hours in the past and verifies it appears in SigNoz.

## Troubleshooting

- **Port 8080 in use:** stop any process bound to 8080 (often an LMS instance on the wrong port). SigNoz requires 8080; LMS demo uses 8081.
- **Cast fails mid-start:** run `docker compose -f pours/deployment/compose.yaml up -d` after freeing conflicting ports.
- **Backdated span not visible:** wait a few seconds after export; ensure `SIGNOZ_API_KEY` is set for the query step.
