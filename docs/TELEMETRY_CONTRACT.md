# LMS telemetry contract (observed)

Frozen from live SigNoz traces exported by `integrations/lms/verify.sh` on 2026-07-24.

## Resource attributes

| Semantic key | Observed storage | Example |
|---|---|---|
| `service.name` | `resources_string['service.name']` | `lms-backend` |
| `service.version` | `resources_string['service.version']` | full 40-char Git SHA |
| `deployment.environment.name` | `resources_string['deployment.environment.name']` | `hackathon-demo` |

## Span attributes (home overview)

| Semantic key | Observed storage | Example |
|---|---|---|
| `http.route` | `attributes_string['http.route']` | `/api/v1/internal/home/overview` |
| `url.path` | `attributes_string['url.path']` | `/api/v1/internal/home/overview` |
| `http.request.method` | `attributes_string['http.request.method']` | `GET` |
| `http.response.status_code` | `response_status_code` column when present | `200` |

## JDBC children

Database spans appear as `SELECT …` span names with:

- `attributes_string['db.system']` = `postgresql`
- `attributes_string['db.name']` = `lms`
- `attributes_string['db.operation']` = `SELECT`

## Query Builder v5 filters

GreenLight regression evaluation uses these exact filter keys (see `signoz/queries/`):

```text
service.name = lms-backend
service.version = <full-sha>
deployment.environment.name = hackathon-demo
http.route = /api/v1/internal/home/overview
```

## Non-causation

Correlation across Claude, CI, deployment, and LMS telemetry is temporal and version-based only. GreenLight never claims a commit caused a regression.

## Phase 1 sample floor

Phase 1 smoke uses a deliberately small request sample. The 200-span minimum verdict floor applies from GL-P4-T02 onward.
