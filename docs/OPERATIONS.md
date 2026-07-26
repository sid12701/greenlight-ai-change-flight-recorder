# GreenLight production operations

## Current production gate

The local container topology is reproducible, non-root, read-only where
practical, loopback-bound, resource-limited, health-ordered, and backed by the
production PostgreSQL adapter. It is **not a production deployment**: it lacks a
managed secret store, TLS ingress, signed application images, staging/canary
promotion, and dated PostgreSQL/SigNoz restore evidence.

Never expose the local SigNoz, OTLP, MCP, API, or Web ports beyond loopback. A
production platform must place the collector, SigNoz, MCP, PostgreSQL, API, and
worker on private networks and expose only the TLS ingress for the Web/API routes.

## Required production secrets

Supply these through the deployment platform secret manager, never an image,
manifest, `.env`, build argument, or CI log:

- scoped GreenLight API keys or OIDC client credentials;
- GitHub App private key, installation ID, and webhook secret;
- SigNoz service-account key, JWT secret, and bootstrap administrator credential;
- PostgreSQL application, migration, backup, and restore credentials;
- workload deployment-provider credentials when a hosted workload is used.

Placeholder/default secret validation is blocking in production mode. Rotate all
historical demo credentials before any network exposure.

## Immutable build and promotion

1. Build API, worker, Web, and workload images once on the protected release commit.
2. Run unit, integration, browser, workload, secret, dependency, SBOM, and image
   scans against those exact images.
3. Sign each image and record its `sha256:` digest and embedded full Git SHA.
4. Deploy digests (never tags) to staging.
5. Run `scripts/acceptance.sh` with live acceptance enabled twice.
6. Promote the same digests to a production canary after manual approval.
7. Verify readiness, queue depth, GreenLight API/worker resource labels, SigNoz
   queries, and receipt evidence before expanding traffic.

## Rollback

1. Pause worker intake if schema or evidence compatibility is uncertain.
2. Route API/Web traffic to the previous signed digests.
3. Deploy the previous worker digest.
4. Keep database migrations backward-compatible for one release; use forward
   repair rather than automated destructive down migrations.
5. Re-run liveness, readiness, dependency, queue, receipt, and SigNoz checks.
6. Record the rollback as an audit event. Do not rewrite or delete evidence.

The workload rollback is also digest-based: deploy the recorded last-known-good image
digest, then verify its embedded SHA, configured health URL, deployment marker,
and exact `service.version` in SigNoz.

## Supply-chain release gate

Use Node 24 for every npm command. The repository gate separates development
tool risk from deployable risk and inspects the final image contents:

```bash
npm ci
npm audit --audit-level=high
npm audit --omit=dev --audit-level=low
npm sbom --omit=dev --sbom-format=cyclonedx > greenlight-production.cdx.json

docker build -f deploy/api.Dockerfile -t greenlight-api:release .
docker build -f deploy/worker.Dockerfile -t greenlight-worker:release .
docker build -f deploy/web.Dockerfile -t greenlight-web:release .
bash scripts/runtime-image-contract.sh \
  greenlight-api:release greenlight-worker:release greenlight-web:release
```

CI performs the blocking Trivy high/critical scan for all three images without
an unfixed-vulnerability exception. The scanner action is exact-SHA pinned.
For local evidence, export images with `docker save` and scan the read-only
archives with the pinned scanner image; do not grant a scanner container the
Docker socket. Distroless API/worker containers intentionally have no shell,
package manager, or interactive debugging tools. Diagnose with structured
logs, health endpoints, SigNoz, and an ephemeral debug image on the same
network rather than modifying a release image.

## Backup and restore

- Run `ops/backup-postgres.sh` from a dedicated backup identity. Store the custom
  dump and checksum in encrypted, versioned, access-logged storage with retention.
- At least monthly, restore into a new isolated database with
  `ops/restore-postgres.sh`; compare row counts and application readiness before
  deleting the drill environment.
- Back up SigNoz according to the pinned deployment's supported ClickHouse and
  object-storage procedure. GreenLight must not query or mutate internal tables.
- A release is not production-ready until both PostgreSQL and SigNoz restore drills
  have dated evidence and the canary rollback restores the previous release.

## Local verification

```bash
cp .env.demo.example .env.demo
npm run demo:up
npm run demo:status
curl --fail http://127.0.0.1:4000/livez
curl --fail http://127.0.0.1:4000/readyz
curl --fail http://127.0.0.1:4173/healthz
```

On the first run, create the SigNoz service-account key exactly as instructed
by the bootstrap, add it to `.env.demo`, and rerun. Blnk is public and needs no
GitHub token. `npm run demo:down` stops all demo services without deleting
volumes; use the explicit per-service destructive reset commands only after
backup and operator approval.

### Verifying the evidence, not just the processes

Health checks prove the stack is running. These prove what it claims is true,
and each fails loudly rather than degrading to a weaker check:

```bash
npm run verify:receipt-links                  # every URL a receipt publishes must open
set -a && . ./.env.demo && set +a
npm run mcp:verify                            # every MCP-reported trace must resolve
npm run ai-link:verify                        # which of the four AI-link links are armed
bash scripts/signoz-runtime-verify.sh         # every running image matches its digest pin
```

`verify:receipt-links` is the one worth running before any demo. It reads the
receipts the way a reader does and requires every published URL to answer, which
catches the class of failure no unit test can: an API that reaches SigNoz at an
address the reader's browser cannot resolve. Set `SIGNOZ_PUBLIC_URL` when those
two differ, which is the case whenever the API runs in a container.

### Resetting between rehearsals

```bash
bash scripts/demo-reset.sh
```

Clears candidate and recovery deployments with their evaluations, incidents,
windows and evidence links, in one transaction against the demo's PostgreSQL. The
frozen baseline and every span in SigNoz are left alone: a baseline is the
yardstick later verdicts are measured against, and re-freezing it would silently
move it. Re-recording therefore reuses the existing baseline rather than
capturing a new one.

### Replacing the baseline

A baseline is frozen, not permanent. When the service legitimately changes what
"normal" means — a larger instance, a major release, a different traffic shape —
every later comparison against the old yardstick is measuring the wrong thing.

Record the new baseline with `supersedeBaseline`:

```jsonc
POST /api/v1/deployments
{
  "role": "baseline",
  "status": "succeeded",
  "supersedeBaseline": true,
  // ...the usual deployment fields
}
```

The previous baseline is retired and the new one becomes what fresh comparisons
resolve to. Two properties make this safe to run against real history:

- **Retired, not deleted.** The old row and its snapshot stay, so an evaluation
  that cites them is still explainable with the baseline it was actually
  measured against — including an open incident, whose recovery is still
  compared against the baseline its regression was found with.
- **Atomic.** Retirement and replacement share one transaction, and a partial
  unique index permits exactly one active baseline per service and environment.
  A replacement that fails its health check or never becomes visible in SigNoz
  leaves the existing baseline active.

Without the flag a second baseline is still refused, so an accidental repeat
cannot move the reference point.
