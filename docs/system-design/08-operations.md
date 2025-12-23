# System Design — Operations (SLOs, Observability, Runbook)

The intent of this doc is to show how this system would be operated in the real world (even at small scale).

## Proposed SLOs (starting point)

These are portfolio-appropriate targets—tight enough to show intent, realistic enough to be achievable.

### API

- **Availability:** 99.9% monthly (excluding planned maintenance)
- **Latency (read endpoints):** p95 < 250ms (steady state)
- **Latency (write endpoints):** p95 < 400ms (steady state)
- **Error rate:** < 1% 5xx over 5 minutes, per route

### Web

- **TTFB:** keep low by doing authenticated data fetching server-side.
- **Core Web Vitals:** aim for “Good” on key flows (home, feed, profile).

## Observability surfaces in this repo

For a hands-on “how to use this” guide, see `docs/observability.md`.

### Health

- `GET /api/health` — basic liveness
- `GET /api/ready` — readiness (checks DB connectivity when DB is enabled)

### Metrics

- `GET /api/metrics` — Prometheus exposition (disabled when `NODE_ENV=test` or `METRICS_ENABLED=false`)
- Captures:
  - total request count by method/route/status
  - request duration histogram by method/route/status
  - in-flight requests gauge

### Logs

- Structured JSON logs per request (when `REQUEST_LOGGING=true`)
- `x-request-id` is generated/propagated for tracing across services

## Runbook: common incidents

### 1) “API is up but DB is failing”

Signals:

- `/api/ready` reports `database: disconnected`
- Elevated 5xx rates on DB-backed endpoints

Actions:

1. Check DB connectivity (network, credentials, TLS config).
2. Verify `DATABASE_SSL` settings for the environment.
3. Check DB connection pool saturation (connections, locks).

### 2) “All authenticated endpoints return 401”

Signals:

- Authenticated requests fail across the board.

Actions:

1. Verify `JWT_SECRET` is set and consistent across API instances.
2. Confirm the web is actually attaching `Authorization: Bearer <token>` in BFF calls.
3. Check token expiry settings (`JWT_EXPIRES_IN`) and server time skew.
4. Ensure `tokenVersion` has not been bumped unexpectedly (logout invalidates old tokens).

### 3) “AI endpoint is slow / timing out”

Signals:

- Increased latency and failures on `/api/ai/rewrite`

Actions:

1. Confirm provider status and network connectivity.
2. Reduce timeouts or add bounded retries only if safe.
3. Apply AI-specific rate limits and per-user caps (budget protection).

### 4) “Media uploads failing”

Signals:

- Presign endpoint works, but browser upload fails (PUT to S3 endpoint).

Actions:

1. Verify allowed content types and file size expectations.
2. Confirm `S3_*` config and object store accessibility.
3. Validate CORS on the object store and correct `S3_PUBLIC_BASE_URL`.

## Operational hygiene checklist

- All “secrets required at runtime” are validated at startup.
- TLS verification is never disabled by default in production.
- Metrics and logs label routes in a stable, high-signal way.
- Migrations run as an explicit deploy step in production (never on multi-replica boot).
- Denormalized counters have a reconciliation path (manual maintenance command/script).
