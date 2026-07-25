# Producing a verified AI-session link

A receipt marks a change's AI link `verified` only when the exact span named by
the commit's `AI-Traceparent` trailer resolves in SigNoz. That requires four
independent things to be true at once, which is why `npm run ai-link:verify`
reports each one separately rather than just saying `missing`.

```bash
npm run ai-link:arm      # install the prepare-commit-msg hook
npm run ai-link:verify   # report which links are armed, and how to arm the rest
```

## The four links

| Link | What it does | Armed by |
|---|---|---|
| `prepare-commit-msg` hook | Writes `AI-Traceparent: <traceparent>` into the commit message | `npm run ai-link:arm` |
| Claude Code telemetry exports | Makes Claude Code emit spans over OTLP | sourcing the env template **before** starting Claude Code |
| `TRACEPARENT` in the environment | Gives the hook a session context to record | `CLAUDE_CODE_PROPAGATE_TRACEPARENT=1` |
| Spans in SigNoz | Makes the recorded ID resolvable | the exporter reaching `:4318` |

The middle two cannot be arranged from inside a running session: Claude Code
reads its telemetry configuration at start-up, so the exports have to be set in
the shell that launches it.

## Procedure

**1. Start the demo stack**, so there is an OTLP endpoint to export to.

```bash
npm run demo:up
npm run demo:status     # SigNoz must be healthy before Claude Code starts
```

**2. Arm the hook** in the repository whose commits you want linked.

```bash
npm run ai-link:arm
```

**3. Start a new Claude Code session with telemetry enabled.** The exports must
be in the environment *before* `claude` starts.

```bash
set -a && . ./instrumentation/claude-code/env.example && set +a
claude
```

The template exports traces, logs and metrics to `http://localhost:4318` with
`always_on` sampling, and explicitly disables prompt, tool-detail and
tool-content export. `scripts/verify-claude-telemetry.sh` asserts those three
privacy flags stay off, and CI runs it.

**4. Confirm the chain is armed** from inside that session.

```bash
set -a && . ./.env.demo && set +a
npm run ai-link:verify
```

All four links must read `ok`. If `spans in SigNoz` still fails, the exporter has
not delivered yet — make any commit and check again.

**5. Make a commit inside that session.** Any commit will do; a docs change is
enough. The hook adds the trailer:

```
docs: note the verified session link

AI-Traceparent: 00-<trace-id>-<span-id>-01
```

**6. Sync the commit** so GreenLight reads the trailer and verifies the span.

```bash
curl -sS -X POST http://127.0.0.1:4000/api/v1/github/sync-latest \
  -H "Authorization: Bearer $GREENLIGHT_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' -d '{"limit":5}'
```

The worker resolves the exact trace and span against
`service.name = claude-code` within ±24h of the commit date. On success the
receipt reads **`AI link: verified`** and the landing page offers the change as a
complete evidence chain.

## Why it can still read `missing`, legitimately

`missing` means no trailer was present. `invalid` means a trailer was present and
could not be parsed. `failed` means a valid trailer named a span SigNoz does not
hold. These are deliberately distinct, and none of them may present as
`verified`:

- A commit made outside an instrumented session has no trailer. That is
  `missing`, and reporting it as anything else would claim evidence that does not
  exist.
- A commit made in an instrumented session whose spans never reached SigNoz is
  `failed` — the commit claimed a session and the claim did not hold up. That is
  a stronger statement than `missing` and is reported separately for that reason.

The recorded demo chain's three commits predate this procedure and read
`missing`. Re-running the chain from an instrumented session links them; leaving
them as they are is also a truthful result, and the receipt says which.

## Privacy

Prompts, tool arguments and tool output are never exported. The span carries
timing and session identity only, which is all the link needs: the point is to
prove *which* session produced a commit, not to record what was said in it.
