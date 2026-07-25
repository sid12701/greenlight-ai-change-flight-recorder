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
captured against the live stack over streamable HTTP from `SigNozMCP v0.9.0`:

| | baseline `6f458c9` | candidate `2fa6e28` |
|---|---|---|
| p95 | 1.59 ms | 8.31 ms |
| error rate | 0% | 32.89% |

Three candidate trace IDs are cited, and each resolves to two spans. These
figures are gathered independently of the receipt's own evaluation, over a
wider window, so they corroborate the verdict rather than restate it.
