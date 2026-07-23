# Backend CI workflow trigger contract

GreenLight must prove that Claude-assisted proof commits trigger exactly one primary backend workflow run. This contract is derived from the isolated LMS demo clone at baseline commit `2269d064f0be50e7f6485c0be38e3cdcef6137d2`.

## Primary workflow

| Field | Value |
|---|---|
| Workflow file | `.github/workflows/backend-ci.yml` |
| Workflow name | `Backend CI` |
| GreenLight config key | `GREENLIGHT_PRIMARY_WORKFLOW_NAME=Backend CI` |

## Path filters (`on.push` and `pull_request`)

- `backend/**`
- `scripts/schema-diff/**`
- `.github/workflows/backend-ci.yml`

## Secondary workflow (not primary)

| Field | Value |
|---|---|
| Workflow file | `.github/workflows/frontend-ci.yml` |
| Workflow name | `Frontend CI` |
| Path filters | `frontend/**`, `openapi/**`, `.github/workflows/frontend-ci.yml` |

Frontend CI runs are stored as related context only. GreenLight links Claude trace context to the primary backend run.

## Proof-commit file (GL-P2-T04)

Use a harmless change under `backend/**` that does not alter runtime behavior.

| Field | Value |
|---|---|
| Selected file | `backend/README.md` |
| Matches filter | Yes (`backend/**`) |
| Rationale | Documentation-only edit; guaranteed to trigger Backend CI without touching production logic |

## Verification

`scripts/preflight.sh` checks that:

1. `backend-ci.yml` exists in the demo clone.
2. The workflow `name:` is exactly `Backend CI`.
3. `backend/**` appears in the push path filters.
4. `backend/README.md` exists and is the documented proof-commit target.
