# SigNoz MCP investigation (Track 3)

GreenLight asks the SigNoz MCP server the same questions an investigating agent
would, rather than calling the query API itself, and records what came back.

Fixed prompt for agent-native rehearsal (do not claim causation):

```text
For service `blnk-loan-workload` version `<candidate-sha>`, environment `hackathon-demo`, compare p95 latency and error rate on route `/balances` against version `<baseline-sha>`, and return the three slowest traces. Report temporal and version correlation only; do not claim the commit caused the change.
```

## Prerequisites

- The stack running via `npm run demo:up` (SigNoz MCP is served at
  `http://127.0.0.1:8000/mcp`)
- `SIGNOZ_API_KEY` set in `.env.demo`
- An incident window produced by `node scripts/demo-chain.mjs`

## Capture

```bash
set -a; . ./.env.demo; set +a
export SIGNOZ_MCP_URL=http://127.0.0.1:8000/mcp
export BASELINE_SHA=<baseline-sha>
export CANDIDATE_SHA=<candidate-sha>
npm run mcp:capture
```

The capture has no direct-API or telemetry-store fallback. If MCP cannot
answer, it fails and writes nothing: a fixture that did not come from MCP would
misrepresent the evidence it claims to be.

## Validate

```bash
npm run mcp:verify
```

The validator checks service, SHA, route, latency and error fields, three trace
IDs, and rejects causal wording. It also resolves every cited trace, so a
transcript quoting a trace that no longer exists fails rather than reading as
proof.

## Recorded result

The transcript committed at `test/fixtures/signoz/mcp-investigation.json` was
captured against the live stack over streamable HTTP from `SigNozMCP v0.9.0`,
over a 15-hour window (`2026-07-25T05:49Z` – `2026-07-25T20:49Z`) chosen so it
contains both versions' traffic, including the receipt's own measured windows:

| | baseline `6f458c9` | candidate `2fa6e28` |
|---|---|---|
| p95 | 1.58 ms | 9.39 ms |
| error rate | 0% | 9.13% |

Three candidate trace IDs are cited, and each resolves to two spans.

These figures are gathered independently of the receipt's own evaluation. The
p95 pair corroborates the verdict — the receipt measured 1.44 ms → 10.45 ms in
its narrow windows; MCP sees 1.58 ms → 9.39 ms across every request either
version ever served.

**The error rates differ, and the difference is the point.** The receipt reports
0% for the candidate because its measured window contains no failures. MCP
reports 9.13% because the wide window also contains an earlier
`demo:dependency-failure` rehearsal of the same version, where the workload's
database was deliberately stopped. Same `service.version`, different windows,
different answers — which is exactly why a verdict is scoped to the window that
was measured rather than to everything a version ever did. A tool that reported
one number for both would be hiding that distinction.

Re-capture with a window that covers both versions:

```bash
set -a; . ./.env.demo; set +a
export SIGNOZ_MCP_URL=http://127.0.0.1:8000/mcp
export BASELINE_SHA=<baseline-sha> CANDIDATE_SHA=<candidate-sha>
export MCP_WINDOW_MINUTES=900
npm run mcp:capture && npm run mcp:verify
```

The default 120-minute window only covers a chain captured in the last two
hours; a frozen baseline needs a window wide enough to reach it, or its figures
come back empty.
