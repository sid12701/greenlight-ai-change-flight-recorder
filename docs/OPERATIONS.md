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
