# Demo state model

## Immutable (never deleted by soft reset)

- `changes` and `pipeline_runs`
- Frozen `role=baseline` deployment and its evaluation window
- SigNoz telemetry (Claude, CI, GreenLight, and Blnk traces)
- Trace-linked commit SHAs and `AI-Traceparent` trailers

## Transient (soft reset clears)

- `role=candidate` and `role=recovery` deployments
- Their `regression_evaluations` and `evidence_links`

## Ports

| Service | Port |
|---|---|
| SigNoz UI | 8080 |
| OTLP HTTP | 4318 |
| SigNoz MCP | 8000 |
| GreenLight API | 4000 |
| GreenLight Web | 4173 |
| Public Blnk workload | 18081 |

## Scripts

```bash
npm run demo:up                 # reconcile and start the complete stack
npm run demo:status             # check all five public health endpoints
npm run demo:down               # stop services; preserve every volume
bash scripts/demo-smoke.sh       # preflight + SigNoz smoke
bash scripts/demo-baseline.sh    # record baseline + load
bash scripts/demo-regression.sh  # candidate incident
bash scripts/demo-recover.sh     # recovery proof
bash scripts/demo-reset.sh       # soft reset between rehearsals
```

`.env.demo` contains operator configuration and the external SigNoz
service-account key. `.workloads/signoz.env`,
`.workloads/greenlight.env`, and `.workloads/blnk.env` contain generated local
secrets. All are ignored and must remain mode 0600.
