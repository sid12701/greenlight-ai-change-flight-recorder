# Demo state model

## Immutable (never deleted by soft reset)

- `changes` and `pipeline_runs`
- Frozen `role=baseline` deployment and its evaluation window
- SigNoz telemetry (Claude, CI, LMS traces)
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
| LMS backend | 8081 |

## Scripts

```bash
bash scripts/demo-smoke.sh      # preflight + SigNoz smoke
bash scripts/demo-baseline.sh    # record baseline + load
bash scripts/demo-regression.sh  # candidate incident
bash scripts/demo-recover.sh     # recovery proof
bash scripts/demo-reset.sh       # soft reset between rehearsals
```
