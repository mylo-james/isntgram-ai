# Isntgram AI

A modern, full-stack social platform built with Next.js (App Router), NestJS, and PostgreSQL — with an optional
AI-assisted “polish” workflow for posts.

## Highlights

- **BFF auth model:** API JWT stays server-side (encrypted Auth.js cookie; never exposed to browser JS)
- **OpenAPI contracts:** shared TypeScript API types generated from the NestJS OpenAPI spec (CI enforced)
- **Typed clients:** `openapi-fetch` clients in web/server consume the generated contract (no stringly-typed endpoints)
- **Cursor-based feeds:** stable pagination by `createdAt` + `id`
- **S3-compatible media uploads:** works with MinIO locally
- **AI assist (optional):** `POST /api/ai/rewrite` via `AI_PROVIDER=mock|openai`
- **Tests:** unit + integration + Playwright E2E

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

Set `AUTH_SECRET` (or `NEXTAUTH_SECRET`) for production runtime. Auth will not work correctly without it.

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
- `docs/deployment.md` — deployment notes
- `docs/adr/` — architecture decisions
- `docs/system-design/` — system design docs
