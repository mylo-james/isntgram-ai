# Observability (logs, metrics, request IDs)

This repo includes a small but production-shaped observability baseline: request IDs, structured logs, Prometheus
metrics, and health/readiness endpoints.

## Endpoints

- `GET /api/health` — liveness (process is up)
- `GET /api/ready` — readiness (includes DB connectivity when DB is enabled)
- `GET /api/metrics` — Prometheus exposition (disabled when `NODE_ENV=test` or `METRICS_ENABLED=false`)

## Request IDs

- The API generates an `x-request-id` if one is not provided.
- The BFF forwards `x-request-id` to the API and returns it to the client.
- The request ID is returned as `x-request-id` and included in logs/error responses.

## Logs

Enable via `REQUEST_LOGGING=true`.

- Emits a structured per-request log line (method, path, route label, status, duration, requestId).
- Route labels are derived after routing so they reflect templates (e.g. `GET /posts/feed`), not raw URLs.

## Metrics

Enable via `METRICS_ENABLED=true`.

The API exports basic HTTP telemetry:

- request count (by method/route/status)
- duration histogram (by method/route/status)
- in-flight requests gauge

Quick local check:

```bash
curl -s http://localhost:3001/api/metrics | head
```

## Notes

- `/api/metrics` is excluded from request histograms and logging to avoid distorting p95s.
- For deeper operational guidance, see `docs/system-design/08-operations.md`.
