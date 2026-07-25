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
bash scripts/demo-smoke.sh      # preflight + SigNoz smoke
bash scripts/demo-reset.sh      # soft reset between rehearsals
```

### Scenarios

```bash
npm run demo:chain -- <baseline> <candidate> [recovery]
npm run demo:dependency-failure -- <baseline> <candidate>
```

`demo:chain` records what a deployed version did and injects nothing.
`demo:dependency-failure` deliberately stops the workload's database inside the
measured window to show GreenLight reporting a failure it cannot attribute to the
commit. They capture their own baseline, so run one or the other against a reset
stack, never both against the same one.

### Verification

```bash
npm run verify:receipt-links    # every URL a receipt publishes must open
npm run ai-link:verify          # which of the four AI-link links are armed
npm run mcp:verify              # every MCP-reported trace must resolve
bash scripts/signoz-runtime-verify.sh
```

`.env.demo` contains operator configuration and the external SigNoz
service-account key. `.workloads/signoz.env`,
`.workloads/greenlight.env`, and `.workloads/blnk.env` contain generated local
secrets. All are ignored and must remain mode 0600.
