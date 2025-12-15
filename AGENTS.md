# AGENTS.md — Isntgram AI

Short, actionable rules for assistants (Codex, Cursor, etc.).

## What to optimize for

- Keep the auth boundary intact (NextAuth ↔ API JWT). Never accept client-supplied identity for sensitive operations.
- Preserve demo-mode safety (server-side read-only enforcement) and rate limiting; do not “fail open”.
- Keep AI integration optional and server-side; tests must not hit real providers by default.
- Prefer small, reversible changes; avoid breaking CI (lint/type-check/tests/coverage) and the Docker/E2E harness.

## Primary commands

- Toolchain: Node 25 (`.nvmrc`), pnpm via Corepack (`pnpm@10.25.0`).
- Install: `corepack enable && corepack prepare pnpm@10.25.0 --activate && pnpm install`.
- Dev (local): `pnpm run dev:db`, then `pnpm run dev:all` (web: `http://localhost:3000`, api:
  `http://localhost:3001/api/health`).
- Quality gates: `pnpm run lint:all`, `pnpm run type-check`, `pnpm test --watchAll=false`.
- Integration tests: `pnpm run test:integration`.
- E2E tests: `pnpm run test:e2e` (builds + Playwright).
- Build: `pnpm run build:all`.
- Package-specific scripts: `pnpm --filter web lint`, `pnpm --filter api start:dev`.

## Coding style

- TypeScript (strict): avoid `any` (`@typescript-eslint/no-explicit-any`); keep DTOs and API responses typed.
- Formatting: Prettier (`.prettierrc`); lint with `pnpm run lint:all`.
- No `console.*` in app code (ESLint); use NestJS `Logger` and structured errors instead.
- NestJS patterns:
  - Keep controllers thin; put business logic in services.
  - Validate inputs via DTOs (`class-validator`) and rely on the global `ValidationPipe`.
  - Throw Nest exceptions (`BadRequestException`, etc.); keep response shape consistent via `GlobalExceptionFilter`.
- Next.js patterns:
  - Respect server/client boundaries (App Router); never access secrets in client components.
  - Auth flows live in `apps/web/lib/auth.ts`; API calls go through `apps/web/lib/api-client.ts`.

## Documentation voice (agent-written docs)

- Target tone: engineer-to-engineer (matter-of-fact, specific, assumes a technical reader).
- Prefer concrete, falsifiable statements (paths, symbols, commands) over “portfolio narrator” language.
- Avoid “AI tutor” voice (no motivational framing, no “remember…”).
- Keep docs aligned with existing references: `README.md`, `ENVIRONMENT.md`, `docs/architecture/*`, `docs/adrs/*`.

## Tests

- Keep the fast lane deterministic: unit tests should not require Docker or network access.
- Unit tests: `pnpm test --watchAll=false` (Jest projects: root/web/api).
- API integration tests: `pnpm run test:integration` (defaults to SQLite in-memory; Postgres parity is opt-in via env).
- E2E tests: `pnpm run test:e2e` (Playwright in `e2e/`), runs against a prod-like Next standalone server.
- External calls:
  - Never hit OpenAI/Sentry in tests by default; mock `global.fetch` (see `apps/api/test/ai.integration.test.ts`).
  - Keep “real provider” paths opt-in via env vars and separate workflows.

## Data, secrets, safety

- Never commit `.env*`, API keys, tokens, or real credentials. Use `apps/*/env.example` and `ENVIRONMENT.md`.
- Demo mode is a safety feature: `DemoReadOnlyGuard` must continue to block mutations for the demo user.
- AI is optional and cost-bearing: keep it gated by `OPENAI_API_KEY`; keep demo AI disabled unless `DEMO_ALLOW_AI=true`.
- Don’t relax security defaults (Helmet/CSP, production CORS checks, throttling) without an explicit request.

## Migrations & DB

- Database: Postgres in prod/dev; SQLite is used heavily in tests.
- TypeORM migrations live in `apps/api/src/migrations/`; don’t edit existing migrations—add new ones.
- Generate/run migrations from `apps/api`:
  - `pnpm --filter api migration:generate`
  - `pnpm --filter api migration:run`
- Production deploy runs `api-migrate` before `api` (see `docker-compose.deploy.yml`).

## Dependency changes

- Use pnpm workspaces; update `package.json` and `pnpm-lock.yaml` together.
- Prefer minimal version bumps; keep Node/pnpm versions in sync with CI.

## Logging & observability

- API: prefer NestJS `Logger`; redact secrets/PII; avoid logging request bodies by default.
- Sentry is optional (env-gated); don’t add user PII to Sentry events.

## PR / commit hygiene

- Keep changes scoped and reversible; don’t move files unnecessarily.
- If tests/commands aren’t run, state what to run: `pnpm run lint:all`, `pnpm run type-check`, `pnpm test`,
  `pnpm run test:e2e`.

## When unsure

- Ask before changing: auth/session behavior, demo safety gates, AI provider calls/billing, CI/deploy workflow, DB
  schema/migrations.

## Repo map (high-yield places)

- Web (Next.js)
  - Auth boundary: `apps/web/lib/auth.ts`
  - API client: `apps/web/lib/api-client.ts`
  - Feed + AI UI: `apps/web/app/feed/Feed.tsx`
  - Explore/search: `apps/web/app/explore/Explore.tsx`, `apps/web/app/search/search-page-client.tsx`
  - Profile/social: `apps/web/app/[username]/*`, `apps/web/components/profile/*`
- API (NestJS)
  - Bootstrap/security: `apps/api/src/main.ts`
  - Auth endpoints: `apps/api/src/auth/*`
  - Demo read-only: `apps/api/src/common/guards/demo-readonly.guard.ts`
  - AI captions: `apps/api/src/ai/*`
  - Error shape: `apps/api/src/common/filters/global-exception.filter.ts`
  - Migrations: `apps/api/src/migrations/*`
- Quality / delivery
  - CI: `.github/workflows/ci.yml`
  - Jest: `jest.config.cjs`
  - E2E: `playwright.config.ts`, `e2e/*`
  - Docker: `apps/*/Dockerfile.prod`, `docker-compose.prod.yml`, `docker-compose.deploy.yml`
  - Env reference: `ENVIRONMENT.md`
  - Evaluator path: `docs/evaluator-guide.md`
