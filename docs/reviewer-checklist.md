# Reviewer Checklist (10-minute tour)

This repo is meant to be evaluated quickly by a hiring manager or senior engineer.

## 1) Quick commands

From the repo root:

```bash
pnpm install
pnpm run contracts:check
pnpm run lint:all
pnpm run type-check
pnpm run build:all
```

Local dev (web + api; starts Postgres/MinIO via Docker):

```bash
cp apps/api/env.example apps/api/.env
cp apps/web/env.example apps/web/.env.local
pnpm run dev:all
```

- Web: `http://localhost:3000`
- API: `http://localhost:3001`
- API docs (non-prod): `http://localhost:3001/api/docs`

## 2) What to look at (high signal)

### Auth boundary (BFF)

- Web keeps the API JWT server-side (Auth.js encrypted cookie + BFF route handlers attach `Authorization`).
- API protects endpoints via JWT guard.
- Auth.js session TTL aligns with API JWT expiry to avoid drift.

Start here:

- `docs/adr/001-auth-model.md`
- `apps/web/app/api/bff/**/route.ts`
- `apps/api/src/auth/jwt.guard.ts`

### Contract-first API consumption

- OpenAPI spec is generated from NestJS and used to generate shared types.
- Web uses a typed client (`openapi-fetch`) to avoid stringly-typed endpoints.

Start here:

- `apps/api/scripts/generate-openapi.ts`
- `packages/shared-types/src/openapi.ts`
- `apps/web/lib/api-client.ts`

### Observability and ops mindset

- Request IDs, route-aware logs, Prometheus metrics, health/readiness endpoints.
- BFF forwards `x-request-id` to the API for end-to-end tracing.

Start here:

- `docs/observability.md`
- `docs/system-design/08-operations.md`
- `apps/api/src/common/interceptors/http-logging.interceptor.ts`
- `apps/api/src/metrics/metrics.interceptor.ts`

### System design “BIG think”

This is the packet I expect a reviewer to skim in ~15 minutes:

- `docs/system-design/01-overview.md`
- `docs/system-design/03-feed-design.md`
- `docs/system-design/05-security-model.md`
- `docs/system-design/07-scaling-triggers.md`
- `docs/system-design/08-operations.md`

## 3) Intentionally not included (portfolio scope control)

- No microservices/event-sourcing/queue-first architecture (documented scaling triggers exist instead).
- No heavy UI framework migration beyond pragmatic Next.js best practices.
- Test hardening is iterative; focus here is architecture + correctness + clarity.
