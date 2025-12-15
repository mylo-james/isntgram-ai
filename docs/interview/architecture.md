# Architecture Overview

## Repo layout

- `apps/web`: Next.js 16 (App Router) frontend (React 19, Tailwind v4)
- `apps/api`: NestJS API (TypeORM + Postgres in prod; SQLite in tests)
- `docs`: evaluator guide, ADRs, architecture notes, deployment runbooks

## High-level topology

Local (dev):

- Web: `http://localhost:3000`
- API: `http://localhost:3001/api/*`
- DB: Postgres via `pnpm run dev:db`

Production (default demo domain):

- Web: `https://isntgram.web.app`
- API: same origin under `https://isntgram.web.app/api/*` (Firebase Hosting rewrites → Cloud Run)

## Auth model

There are two layers by design:

1. **Web session (NextAuth/Auth.js)**
   - Credentials provider lives in `apps/web/lib/auth.ts`
   - The credentials callback authenticates against the API: `POST /api/auth/signin`
   - The API returns `{ user, accessToken }`
   - NextAuth stores `accessToken` in the session (JWT strategy)

2. **API authorization (NestJS JWT bearer)**
   - Protected endpoints require `Authorization: Bearer <accessToken>`
   - Identity is derived server-side from the JWT subject (`sub`)
   - “Me” style endpoints do not accept client-supplied user IDs

This keeps the UI session semantics decoupled from the API’s authorization boundary.

## Demo mode safety

- Demo user is created/seeded via `POST /api/auth/demo`
- Mutations are blocked server-side for the demo account by email:
  - `apps/api/src/common/guards/demo-readonly.guard.ts`
- The UI shows a banner if the session indicates demo mode:
  - `apps/web/components/common/DemoBanner.tsx`

## Data model (core entities)

- Users: `apps/api/src/users/entities/user.entity.ts`
- Posts: `apps/api/src/posts/entities/post.entity.ts`
- Comments: `apps/api/src/comments/entities/comment.entity.ts`
- Likes: `apps/api/src/likes/entities/post-like.entity.ts`
- Follows: `apps/api/src/follows/entities/follows.entity.ts`

The app uses a few denormalized counters (`postsCount`, `likesCount`, etc.) to keep the UI fast and simple.

## Error handling

- API uses a consistent error shape via a global exception filter:
  - `apps/api/src/common/filters/global-exception.filter.ts`
- The web client centralizes API error handling in:
  - `apps/web/lib/api-client.ts`

## Testing strategy

- Jest multi-project config at root: `jest.config.cjs`
  - Web component/page tests (RTL + jsdom)
  - API unit + integration tests (SQLite in-memory)
- Playwright E2E: `playwright.config.ts`
  - Runs against a prod-like Next standalone server (`output: "standalone"`)
  - Runs Nest from built output (`apps/api/dist`)
