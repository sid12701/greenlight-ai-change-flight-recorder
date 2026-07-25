# Blnk loan-processing workload

This integration replaces the inaccessible private LMS dependency with the
public Apache-2.0 Blnk release pinned in
[DEPENDENCY_REVIEW.md](DEPENDENCY_REVIEW.md). It does not vendor third-party
source.

## Start from a clean machine

Prerequisites are Git, Docker with Compose v2, Node.js 24, curl, and OpenSSL.
SigNoz should accept OTLP HTTP on host port `4318`.

```bash
bash integrations/blnk/up.sh
```

The script fetches and verifies Blnk, applies one audited OTel compatibility
patch, generates a local secret, builds the non-root image, waits for ordered
startup, and idempotently seeds a synthetic loan ledger.

Generate normal traffic:

```bash
set -a
source .workloads/blnk.env
set +a
node integrations/blnk/load.mjs --profile healthy --requests 250 --concurrency 5 --duration-seconds 90
```

Generate harmless application-level 404 traffic:

```bash
node integrations/blnk/load.mjs --profile not-found --requests 80 --concurrency 4 --duration-seconds 60
```

Exercise a real, reversible database-dependency outage and recovery. The script
stops only this Compose project's PostgreSQL container and installs an exit trap
that restarts it:

```bash
bash integrations/blnk/failure-cycle.sh
```

Verify the source boundary at any time:

```bash
bash integrations/blnk/fetch.sh --verify
docker compose --env-file .workloads/blnk.env -f integrations/blnk/compose.yaml ps
curl --fail http://127.0.0.1:18081/health
```

Stop while preserving local data:

```bash
bash integrations/blnk/down.sh
```

Use `bash integrations/blnk/down.sh --volumes` only when an explicit clean
local reset is intended.
