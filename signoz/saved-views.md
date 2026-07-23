# SigNoz saved views (demo)

## LMS home overview by version

Filter in the SigNoz Traces explorer:

| Field | Operator | Value |
|---|---|---|
| `service.name` | `=` | `lms-backend` |
| `deployment.environment.name` | `=` | `hackathon-demo` |
| `http.route` | `=` | `/api/v1/internal/home/overview` |
| `service.version` | `=` | `<commit-sha>` |

Deep link template (replace host and SHA):

```text
http://localhost:8080/traces-explorer?serviceName=lms-backend&httpRoute=%2Fapi%2Fv1%2Finternal%2Fhome%2Foverview
```

Programmatic queries live in `signoz/queries/` and are rendered by the GreenLight API SigNoz adapter.
