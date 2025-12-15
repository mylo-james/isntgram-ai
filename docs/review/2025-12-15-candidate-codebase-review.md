# Codebase Review — Isntgram AI (Portfolio)

Date: **2025-12-15**  
Reviewer: Senior Fullstack Engineer / CTO (simulated)

## Executive summary

This is a strong, production-minded portfolio codebase: a Next.js (App Router) + NestJS API monorepo with meaningful
automated testing (unit/integration + Playwright E2E), CI quality gates, containerization, and documented deployment
paths.

If I received this as a candidate submission, I would **advance to interviews** and use the interview time to probe (1)
depth (auth/security/data modeling), and (2) judgment (what to simplify / what to ship next).

## Quality gates to run before sharing

```bash
pnpm run lint:all
pnpm run type-check
pnpm test --watchAll=false
pnpm run build:all
pnpm run test:e2e
```

## Strengths (what this repo demonstrates well)

### 1) Production readiness and delivery story

- Clear separation of concerns: `apps/web` (Next.js) and `apps/api` (NestJS), plus workspace tooling (`pnpm`).
- Realistic production runtime: Next.js `output: "standalone"` + dedicated production Dockerfiles:
  - `apps/web/Dockerfile.prod`
  - `apps/api/Dockerfile.prod`
- Multiple deployment paths with runnable infra artifacts:
  - VM deploy via GHCR + Docker Compose + Caddy: `docker-compose.deploy.yml`, `docker/caddy/Caddyfile`,
    `docs/deployment/runbook.md`
  - Cloud Run + Secret Manager automation: `scripts/deploy/cloud-run.sh`

### 2) Testing discipline (breadth + realism)

- Jest configured as a multi-project setup with coverage thresholds: `jest.config.cjs`
- API has unit-style and integration tests (`supertest` with SQLite memory DB) covering critical flows:
  - Auth, follows, posts, search, AI: `apps/api/test/*`
- Playwright E2E runs against a prod-like standalone Next server + built Nest server: `playwright.config.ts`
- Basic a11y smoke coverage exists (axe + Playwright).

### 3) Security thinking in the right places

- Password hashing uses `argon2id`: `apps/api/src/auth/auth.service.ts`
- Global request validation w/ whitelisting + forbid unknown fields: `apps/api/src/main.ts`
- Clear auth boundary for “me” style endpoints; avoids classic IDOR footguns:
  - `GET /api/users/me`, `PUT /api/users/profile`: `apps/api/src/users/users.controller.ts`
  - Documented in ADR: `docs/adrs/0001-auth-boundary-and-demo-mode.md`
- Demo-mode protections are server-side enforced: `apps/api/src/common/guards/demo-readonly.guard.ts`
- CI includes security gates (CodeQL, gitleaks, trivy + SBOM): `.github/workflows/ci.yml`

### 4) Modern “server-first” posture is visible

- Feed is server-auth-gated and server-prefetched: `apps/web/app/feed/page.tsx`
- Mutations use Server Actions in a way that preserves the auth boundary:
  - Create post: `apps/web/app/feed/actions.ts`
  - Like/unlike: `apps/web/components/posts/like-actions.ts`

### 5) Typed contract story exists (OpenAPI → generated types)

- API spec generation: `apps/api/openapi.json` (via `pnpm run openapi:types`)
- Generated TS types: `apps/web/lib/generated/api.ts`
- Web consumes generated types for key shapes: `apps/web/lib/api-client.ts`

## Weaknesses / risks (what I would probe or improve next)

### 1) Server-first coverage is partial

Some routes still fetch primarily client-side (e.g. post detail in `apps/web/app/posts/[id]/post-detail.tsx`). I would
ask what the intended “server-first” strategy is and how to decide what stays on the client.

### 2) OpenAPI coverage is still incomplete

Posts/likes are documented well enough to generate usable types, but other areas (comments, users, search) still need
response schema work to make “generated types everywhere” viable.

### 3) Test noise

Jest output currently includes warnings about an outdated JSX transform and a Node `--localstorage-file` flag. Not
failing, but I’d clean these up before sharing widely.

## Interview questions I would ask (to confirm depth + ownership)

1. Walk through the auth boundary end-to-end: NextAuth session → API JWT bearer token. What are the tradeoffs?
2. How would you add refresh tokens / session revocation? What would you store server-side?
3. How would you build a personalized feed from follows? What indexes/queries and what caching strategy?
4. What threats did you explicitly design against (IDOR, replay, CSRF/XSS, brute-force), and where are they enforced?
5. If you had one day to simplify this repo for a small startup, what would you delete/refactor first, and why?

## Bottom line

This codebase demonstrates fullstack maturity beyond “toy app” work: tests that run in CI, production containers,
security gates, and documentation that makes the repo evaluable.
