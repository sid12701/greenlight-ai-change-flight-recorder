# Contributing

## Getting set up

Node 24 and Docker with Compose v2 are the only prerequisites for the code.
Running the demo stack needs the extras listed in the [README](README.md).

```bash
npm ci
npm run verify   # clean, lint, typecheck, test, build
```

## Working on a change

1. Branch from `main`.
2. Write the test first for logic with boundaries worth pinning — evaluator
   thresholds, query parsing, retry policy, schema validation. Infrastructure
   and live-integration work is verified by a deterministic validation script
   or fixture check instead, rather than by inventing a unit-test seam for it.
3. Keep each commit one coherent slice, with a Conventional Commit subject.
4. Run `npm run verify` plus any gate your change touches
   (`npm run quality`, `npm run validate:config`, `npm run validate:telemetry`,
   `npm run validate:signoz-assets`, `npm run validate:signoz-stack`).
5. Do not use `--no-verify`.

## Conventions the review enforces

- **State absence as absence.** A dependency that could not be reached is never
  recorded as evidence that something does not exist. The three outcomes —
  a value, a confirmed nothing, and a failure — stay distinguishable end to end.
- **Comments explain why, not what.** A comment earns its place by recording a
  decision or a trap the code cannot state on its own.
- **Integration, exporter, and query-window changes carry the same evidence
  burden as module changes.** A code change alone does not close the work.
- **No AI `Co-authored-by` trailers.** AI assistants are tools, not authors.
  See [PROVENANCE.md](PROVENANCE.md).
