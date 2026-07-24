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

The generated Foundry Compose file is not safe to expose directly because it may
contain floating images, demo database credentials, and host-wide port bindings.
Start it only with the checked-in production-safety override and secret-sourced,
digest-pinned images:

```bash
export SIGNOZ_IMAGE='signoz/signoz@sha256:<digest>'
export SIGNOZ_OTEL_COLLECTOR_IMAGE='signoz/signoz-otel-collector@sha256:<digest>'
export SIGNOZ_MCP_IMAGE='signoz/signoz-mcp-server@sha256:<digest>'
export SIGNOZ_POSTGRES_PASSWORD='<secret-manager-value>'
export SIGNOZ_JWT_SECRET='<secret-manager-value>'
docker compose \
  -f pours/deployment/compose.yaml \
  -f deploy/signoz-compose.override.yaml \
  up -d
```

The override binds UI, MCP, and both OTLP transports to loopback, adds dependency
health ordering and resource ceilings, removes the generated PostgreSQL password,
and requires SigNoz JWT security. Production uses private networks and TLS ingress
instead of any host port.

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

## Dashboards and alert rules

Versioned assets live in `signoz/dashboards/` and `signoz/alerts/` and target the
SigNoz **v6 dashboard schema** and **v1 alert-rule schema**.

```bash
npm run validate:signoz-assets          # schema check, no network
SIGNOZ_API_KEY=... npm run signoz:import   # import and read back
```

`validate` is a structural check only. `import` is the authoritative gate: it
posts each asset to a real SigNoz, reads it back, and fails if the stored panel
count does not match the asset. Import requires a service-account API key with
an assigned role (Settings → Service Accounts → create account, assign
`signoz-admin`, then create a key).

Alert rules require at least one notification channel. Channel names are
environment-specific, so the assets ship with `preferredChannels: []` and the
importer fills them from `SIGNOZ_ALERT_CHANNELS` (comma-separated). Without it
the dashboards still import and the alert import is skipped with a warning.

Create a channel once per installation, then import:

```bash
curl -X POST "$SIGNOZ_URL/api/v1/channels" \
  -H "SIGNOZ-API-KEY: $SIGNOZ_API_KEY" -H 'Content-Type: application/json' \
  -d '{"name":"greenlight-webhook","webhook_configs":[{"send_resolved":true,"url":"<your-receiver>"}]}'

SIGNOZ_ALERT_CHANNELS=greenlight-webhook npm run signoz:import
```

### Known upstream gap (SigNoz v0.134.0)

The bundled web UI does not yet render v6 dashboards. Assets import correctly
and `GET /api/v1/dashboards/{id}` returns the full panel, layout and variable
tree, but the dashboard page shows its empty state. Dashboards created through
the UI in this version also fail to persist their panels, so this is an upstream
UI/API transition rather than a problem with these assets. Verify imports with
the API until the UI catches up:

```bash
curl -s "$SIGNOZ_URL/api/v1/dashboards/<id>" -H "SIGNOZ-API-KEY: $SIGNOZ_API_KEY" \
  | python3 -c 'import json,sys; print(list(json.load(sys.stdin)["data"]["data"]["spec"]["panels"]))'
```

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
