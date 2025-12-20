# Isntgram AI

A modern, full-stack social platform built with Next.js (App Router), NestJS, and PostgreSQL — with an optional
AI-assisted “polish” workflow for posts.

## Highlights

- **BFF auth model:** API JWT stays server-side (encrypted Auth.js cookie; never exposed to browser JS)
- **CSRF protection:** double-submit token + origin checks on all BFF mutations
- **Session alignment:** Auth.js session lifetime aligned with API JWT expiry
- **OpenAPI contracts:** shared TypeScript API types generated from the NestJS OpenAPI spec (CI enforced)
- **Typed clients:** `openapi-fetch` clients in web/server consume the generated contract (no stringly-typed endpoints)
- **Cursor-based feeds:** stable pagination by `createdAt` + `id`
- **S3-compatible media uploads:** works with MinIO locally
- **AI assist (optional):** `POST /api/ai/rewrite` via `AI_PROVIDER=mock|openai`
- **Rate limits:** auth + AI + media endpoints are throttled to prevent abuse
- **Tests:** unit + integration + Playwright E2E

## Product brief

Isntgram is a signal-first social feed designed for thoughtful updates. The core product focuses on:

- A fast, readable feed with stable pagination.
- A clean posting flow with optional AI “polish.”
- A profile experience that encourages follow-driven discovery.

## Engineering brief

- **Security posture:** BFF auth boundary, CSRF protection with rotation, strict origin checks, and token revocation.
- **Operational readiness:** request IDs, structured logs, Prometheus metrics, health/readiness endpoints.
- **Scalability path:** fan-out on read today, with an explicit roadmap for caching and hybrid timelines.

## Start here (for reviewers)

- `docs/reviewer-checklist.md` — 10-minute tour + commands
- `docs/system-design/` — system design packet (15-minute read)
- `docs/observability.md` — metrics/logs/request IDs (hands-on)
- `docs/adr/001-auth-model.md` — auth boundary rationale

## What this demonstrates (portfolio intent)

- **Modern full-stack patterns:** Next.js App Router + NestJS, with clear client/server boundaries
- **Security-first auth:** server-side token handling (BFF), JWT guards, rate limiting, Helmet headers
- **Contract-first API consumption:** OpenAPI → generated types → typed client calls
- **Operational readiness:** request IDs, structured logs, Prometheus metrics, health/readiness endpoints
- **Scaling thinking:** pragmatic feed design + explicit scaling triggers in `docs/system-design/`
- **Resume-ready mapping:** ready-to-copy bullets in `docs/resume-bullets.md`

## Key decisions (and why)

- **BFF auth boundary:** keep API JWTs server-side to reduce XSS token theft risk and simplify client code.
- **Token revocation:** API JWTs include a `tokenVersion` so logout can invalidate existing tokens.
- **OpenAPI as contract:** one source of truth for endpoints/types; `contracts:check` enforces determinism.
- **Cursor pagination:** stable ordering and predictable paging under concurrent writes.
- **Feed strategy:** fan-out-on-read to keep early-stage complexity low; scaling triggers are documented.

## Tradeoffs / non-goals

- No queues/event-driven architecture until there’s a measurable need (see scaling triggers).
- No token access from client JavaScript (avoids “localStorage JWT” footguns).
- Demo mode is intentionally **read-only** and exists to support fast review flows.

## Quick Start

### Prerequisites

- Node.js 20.9+
- pnpm 9+
- Docker Desktop (for Postgres + optional MinIO)

### Setup

```bash
pnpm install
cp apps/api/env.example apps/api/.env
cp apps/web/env.example apps/web/.env.local
pnpm run dev:db
pnpm run dev:all
```

- Web: <http://localhost:3000>
- API: <http://localhost:3001>
- API docs (non-prod): <http://localhost:3001/api/docs>

### Demo Mode

Set `DEMO_ENABLED=true` in `apps/api/.env` to allow the demo sign-in flow.

### AI Mode (optional)

- Default: `AI_PROVIDER=mock` (no external keys; deterministic rewrite for local dev/tests)
- Real LLM: set `AI_PROVIDER=openai` and `OPENAI_API_KEY` in `apps/api/.env`

### Production secrets

Set `AUTH_SECRET` (or `NEXTAUTH_SECRET`) for production runtime. Auth will not work correctly without it. Optionally set
`AUTH_SESSION_MAX_AGE` to align Auth.js session lifetime with `JWT_EXPIRES_IN`.

## Scripts

```bash
pnpm run validate
pnpm run contracts:check
pnpm run lint:all
pnpm run type-check
pnpm run test -- --watchAll=false
pnpm run test:e2e
```

## Database + Migrations

Migrations run automatically on API startup in non-test environments. If you want to run them manually:

```bash
pnpm --filter api migration:run
```

## Media Uploads (S3-compatible)

Local dev uses MinIO (via `docker-compose.yml`). Configure these in `apps/api/.env`:

- `S3_BUCKET`
- `S3_REGION`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_ENDPOINT` (for MinIO)
- `S3_PUBLIC_BASE_URL`

## Production (Docker)

```bash
docker compose -f docker-compose.prod.yml up --build
```

Services:

- `web` (Next.js)
- `api` (NestJS)
- `postgres`

## Project Structure

```text
apps/
  api/        NestJS API
  web/        Next.js App Router
packages/
  shared-types/
```

## Documentation

- `ENVIRONMENT.md` — full env var reference
- `docs/reviewer-checklist.md` — fastest way to review this repo
- `docs/resume-bullets.md` — bullet mapping for job applications
- `docs/observability.md` — logs, metrics, request IDs
- `docs/deployment.md` — deployment notes
- `docs/adr/` — architecture decisions
- `docs/system-design/` — system design docs
