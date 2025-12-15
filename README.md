# Isntgram AI

A production-minded, full-stack social app (Next.js + NestJS) built as a portfolio project with real CI, Docker, and E2E
coverage.

Live demo:

- Web: `https://isntgram.web.app`
- Health: `https://isntgram.web.app/health`
- API health (via same-origin rewrite): `https://isntgram.web.app/api/health`

## What this demonstrates

- End-to-end auth boundary (NextAuth credentials → API JWT bearer) with server-side demo read-only enforcement
- Meaningful automated testing (Jest + Playwright E2E + basic a11y smoke)
- Production container story (Next.js standalone + NestJS) and runnable deploy paths (Cloud Run and VM)
- CI with quality gates and security scans (lint/type-check/tests/coverage + CodeQL/Gitleaks/Trivy/SBOM)

## Portfolio media

- Demo video: `docs/assets/demo.webm` (generated via `pnpm run portfolio:artifacts`)
- Screenshots: `docs/assets/`
- Lighthouse baseline: `docs/perf/lighthouse-2025-12-14.md`

## Evaluator (5 minutes)

1. Login via `/login`:
   - **Try our demo** (read-only) to browse quickly, or
   - Register via `/register` for full access
2. **Feed**: create a post, use **AI caption suggestions** (optional), like/unlike, open post detail
3. **Post detail**: add a comment, delete your own post/comment
4. **Explore/Search**: search users or hashtags; click a hashtag inside a post
5. **Profile**: view posts grid, follow/unfollow another user

See: `docs/evaluator-guide.md`

## Stack

- **Web**: Next.js 16 (App Router), NextAuth (credentials), Tailwind v4
- **API**: NestJS, TypeORM, Postgres (prod) + SQLite (tests), JWT auth
- **Quality gates**: ESLint, TypeScript, Jest, Playwright
- **Containers**: production Dockerfiles + Compose; GHCR publishing + optional VM deploy

## Local development

Prereqs: Node 25+, `pnpm@10.25.0` (via Corepack), Docker.

```bash
corepack enable
corepack prepare pnpm@10.25.0 --activate
pnpm install

pnpm run dev:db
cp apps/api/env.example apps/api/.env
cp apps/web/env.example apps/web/.env.local
```

Set required secrets (local):

```bash
echo "JWT_SECRET=$(openssl rand -base64 32)" >> apps/api/.env
```

Run:

```bash
pnpm run dev:all
# web: http://localhost:3000
# api: http://localhost:3001/api/health
```

## Prod-like local run (Docker)

```bash
docker compose -f docker-compose.prod.yml up --build
# web: http://localhost:3100
# api: http://localhost:3101/api/health
```

## Tests / quality gates

```bash
pnpm run lint:all
pnpm run type-check
pnpm test --watchAll=false
pnpm run openapi:check
pnpm run test:e2e
pnpm run build:all
```

## Deployment

- Cheap + easy deploy (Firebase Hosting + Cloud Run): `docs/deployment/firebase-cloud-run.md`
- VM deploy (Docker Compose + Caddy + GHCR): `docs/deployment/runbook.md`
- Deploy compose file: `docker-compose.deploy.yml`

## Interview prep (docs)

- Interview kit (architecture + tradeoffs + scaling + security): `docs/interview/README.md`
- Evaluator path: `docs/evaluator-guide.md`

## Repo notes

- Environment variables: `ENVIRONMENT.md`
- Portfolio one-pager: `docs/portfolio.md`
- Notes from a simulated review pass: `docs/reviews/2025-12-15-cto-hiring-review.md`
