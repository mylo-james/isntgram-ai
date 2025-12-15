# Evaluator Guide (5-minute tour)

This repo is intended to be reviewed like a real production codebase: working product path, security boundaries, tests,
and a deployable container story.

## What to click (UI)

1. **Login**
   - Go to `/login` and click **Try our demo** (read-only), or register a new account via `/register` (full access)
2. **Demo (read-only)**
   - Browse `/feed` and open a post detail page
   - Explore `/explore` and search `/search` (usernames + hashtags)
3. **Full access (register a user)**
   - **Feed**: create a post, use **AI suggestions** (requires `OPENAI_API_KEY`), like/unlike, open post detail
   - **Post detail**: add/delete your own comments; delete your own post
   - **Profile + Social graph**: visit `/[username]`, follow/unfollow, view posts grid

## Where to look in code

### Web (Next.js)

- Auth + session boundary: `apps/web/lib/auth.ts`
- API client layer: `apps/web/lib/api-client.ts`
- Feed: `apps/web/app/feed/Feed.tsx`
- AI caption suggestions UI: `apps/web/app/feed/Feed.tsx`
- Explore: `apps/web/app/explore/Explore.tsx`
- Search: `apps/web/app/search/search-page-client.tsx`
- Post detail + comments UI: `apps/web/app/posts/[id]/post-detail.tsx`
- Like button: `apps/web/components/posts/LikeButton.tsx`
- Hashtag rendering: `apps/web/components/posts/PostContent.tsx`
- Header/nav state: `apps/web/components/common/SiteHeader.tsx`

### API (NestJS)

- Auth endpoints: `apps/api/src/auth/auth.controller.ts`, `apps/api/src/auth/auth-nextauth.controller.ts`
- JWT guard + optional auth: `apps/api/src/auth/jwt-auth.guard.ts`, `apps/api/src/auth/optional-jwt-auth.guard.ts`
- Demo-mode write protection: `apps/api/src/common/guards/demo-readonly.guard.ts`
- AI captions: `apps/api/src/ai/*` (`POST /api/ai/captions`)
- Posts: `apps/api/src/posts/*`
- Likes: `apps/api/src/likes/*`
- Comments: `apps/api/src/comments/*`
- Search: `apps/api/src/search/*`
- Migrations: `apps/api/src/migrations/*`

### Quality / delivery

- CI pipeline: `.github/workflows/ci.yml`
- E2E tests: `e2e/*` (Playwright)
- Production Docker: `apps/web/Dockerfile.prod`, `apps/api/Dockerfile.prod`
- Local prod-like compose: `docker-compose.prod.yml`
- Deployment compose + runbook: `docker-compose.deploy.yml`, `docs/deployment/runbook.md`

## Quick commands

```bash
pnpm run lint:all
pnpm run type-check
pnpm test --watchAll=false
pnpm run test:e2e
```
