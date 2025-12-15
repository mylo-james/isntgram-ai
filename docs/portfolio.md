# Isntgram AI — Portfolio One-Pager

## TL;DR

Isntgram is a production-minded, fullstack social app with a deliberate focus on the things teams actually care about:
auth boundaries, safe demo mode, typed API contracts, automated tests, and a runnable deployment story.

If you only have 3–5 minutes:

1. Follow `docs/evaluator-guide.md`
2. Skim ADRs in `docs/adrs/`
3. Run: `pnpm run lint:all && pnpm run type-check && pnpm test --watchAll=false`

## What this repo demonstrates (engineering signals)

### Auth boundary + demo-mode safety

- Web session (Auth.js / NextAuth) → API JWT bearer boundary: `apps/web/lib/auth.ts`, `apps/api/src/auth/*`
- Identity is server-derived for “me” operations: `apps/api/src/users/users.controller.ts`
- Demo user is server-side read-only: `apps/api/src/common/guards/demo-readonly.guard.ts`

### Typed contract between web and API

- API OpenAPI generation: `apps/api/scripts/openapi.ts`
- Web types generated via `openapi-typescript`: `apps/web/lib/generated/api.ts`
- Contract check in CI/local: `pnpm run openapi:check`

### “Server-first” Next.js patterns

- Server-auth-gated, server-prefetched feed: `apps/web/app/feed/page.tsx`
- Server Actions for mutations + optimistic UI:
  - Create post: `apps/web/app/feed/actions.ts`
  - Like/unlike: `apps/web/components/posts/like-actions.ts`, `apps/web/components/posts/LikeButton.tsx`
- Post detail server-prefetch + client island: `apps/web/app/posts/[id]/page.tsx`,
  `apps/web/app/posts/[id]/post-detail.tsx`

### Testing + CI that resembles real work

- Jest multi-project (web/api) + coverage thresholds: `jest.config.cjs`
- API integration tests run on SQLite in-memory by default: `apps/api/test/*`
- AI tests mock the provider (no real network calls): `apps/api/test/ai.integration.test.ts`
- Playwright E2E runs against prod-like servers: `playwright.config.ts`, `e2e/*`
- CI pipeline with quality gates and security scans: `.github/workflows/ci.yml`

## Local commands (happy path)

```bash
corepack enable
corepack prepare pnpm@10.25.0 --activate
pnpm install

pnpm run dev:db
cp apps/api/env.example apps/api/.env
cp apps/web/env.example apps/web/.env.local
echo "JWT_SECRET=$(openssl rand -base64 32)" >> apps/api/.env

pnpm run dev:all
```

## If I had 2 more weeks (scoped roadmap)

- Refresh tokens / session revocation (keep boundary intact)
- Personal feed query (follows-based) + indexes + pagination strategy
- Postgres search upgrade path (e.g., trigram index) with clear perf notes
- OpenTelemetry traces (optional) alongside Sentry (optional)
