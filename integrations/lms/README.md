# LMS demo workload integration

The Bhawana LMS is a **pre-existing monitored workload**. GreenLight never modifies the maintainer's primary checkout. All hackathon demo work runs in an isolated clone documented here.

## Paths

| Path | Role |
|---|---|
| `/Users/siddhant/Desktop/lms` | **Forbidden** as `LMS_PATH` — primary maintainer checkout |
| `/Users/siddhant/Desktop/lms-greenlight-demo` | Default isolated demo clone for GreenLight |

## Pinned versions

| Field | Value |
|---|---|
| Baseline commit (frozen demo anchor) | `2269d064f0be50e7f6485c0be38e3cdcef6137d2` (July 16, 2026) |
| Demo branch | `greenlight-demo` |
| Upstream `main` at isolation time | `bfd571f3bc1a22c6e4c7d411c7a447cfffe8a7e0` (one commit after baseline; not used for the demo anchor) |

The source clone is used only to build and test immutable images in CI. Deployment
never checks out or builds source on the target host. Each image must be signed,
addressed by digest, and carry the full source SHA in the
`org.opencontainers.image.revision` label.

## Target route

```text
GET /api/v1/internal/home/overview
```

The blue baseline/recovery slot listens on loopback port **8081** and the green
candidate slot on **8082** (SigNoz UI uses 8080). Include both exact origins in
`GREENLIGHT_HEALTH_ALLOWED_ORIGINS`; each load phase targets its own slot.

## Obtain the demo clone

Use the hosted, protected demo repository configured by `GITHUB_REPOSITORY`.
Do not use a local-path remote as acceptance evidence. A local clone is only a
development convenience:

```bash
git clone https://github.com/your-org/bhawana-lms-greenlight-demo.git /Users/siddhant/Desktop/lms-greenlight-demo
cd /Users/siddhant/Desktop/lms-greenlight-demo
git checkout greenlight-demo
```

Verify:

```bash
export LMS_PATH=/Users/siddhant/Desktop/lms-greenlight-demo
bash /Users/siddhant/Desktop/hackathon/scripts/preflight.sh
```

## Minimal infrastructure (home overview)

Phase 1 will empirically confirm startup requirements. Preflight documents the expected minimum from code and LMS README inspection:

| Service | Required | Notes |
|---|---|---|
| PostgreSQL | Yes | `HomeDashboardService` reads via JPA repositories |
| RabbitMQ | Yes | Local profile defaults to `localhost:5672` |
| Redis | No (default) | `app.rate-limit.enabled=false` in `application-local.yml` |
| MinIO | No | Home overview does not touch document storage |
| Mailhog | No | Not on the home-overview read path |

Start only these compose services unless Phase 1 proves otherwise:

```bash
docker compose -f infra/docker-compose.yml up -d postgres rabbitmq
```

## Configuration

Copy [demo-config.example](demo-config.example) values into your local `.env` or shell environment. See [workflow-trigger-contract.md](workflow-trigger-contract.md) for Backend CI proof-commit rules.

## Immutable deployment

```bash
export LMS_IMAGE='ghcr.io/your-org/bhawana-lms@sha256:<64-hex-digest>'
export LMS_ENV_FILE=/secure/path/lms-runtime.env
export GITHUB_REPOSITORY=your-org/bhawana-lms-greenlight-demo
export GREENLIGHT_ADMIN_TOKEN='<scoped deploy key>'
bash integrations/lms/deploy.sh <full-40-character-sha> candidate
```

The script verifies the image revision label, starts a named blue/green slot with
resource and filesystem restrictions, polls the configured health URL, submits
an idempotent deployment event, and waits for the durable worker job result. It
refuses mutable tags, mismatched SHAs, unconfigured repositories, or missing
secret files.

## Judge access

The LMS repository may remain private. If judges cannot access the demo branch, GreenLight will document the one-hour minimal HTTP fixture fallback described in [docs/OPEN_DECISIONS.md](../../docs/OPEN_DECISIONS.md).
