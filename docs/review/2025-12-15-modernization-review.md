# Modernization Review — Isntgram AI (Frontend / React + Next.js)

Date: **2025-12-15**  
Scope: `apps/web` (Next.js App Router) plus repo-level contract/tooling that materially impacts frontend work.

## Executive summary (what changed in this pass)

### Platform baseline: “latest” and consistent everywhere

- Node baseline is **25** across local, CI, and Docker:
  - `.nvmrc`, `package.json#engines`, `.github/workflows/ci.yml`
  - Docker: `Dockerfile.test`, `apps/web/Dockerfile.prod`, `apps/api/Dockerfile.prod`
- App/runtime stack is current and pinned:
  - Next **16.0.10** + React **19.2.3** (`package.json`, `apps/web/package.json`)
  - Tailwind **4.1.18** (`apps/web/package.json`)
  - Nest **11.1.9** (`apps/api/package.json`)

### “Server-first + Actions” adoption (React 19 / Next App Router)

- `/feed` is now **server-auth-gated** and **server-prefetched**:
  - `apps/web/app/feed/page.tsx` uses `auth()` and server-side `fetch` to populate initial feed state.
- Creating a post is now a **Server Action** + **`useActionState`** form:
  - Server Action: `apps/web/app/feed/actions.ts`
  - UI wiring: `apps/web/app/feed/Feed.tsx`
- Likes are now **Server Action** + **`useOptimistic`** + **`useTransition`**:
  - Server Action: `apps/web/components/posts/like-actions.ts`
  - UI wiring: `apps/web/components/posts/LikeButton.tsx`

### Typed API contract: OpenAPI → generated types (and actually used)

- API now produces an OpenAPI spec with meaningful schemas:
  - DTO schema annotations: `apps/api/src/*/dto/*.ts`
  - Response shapes documented for posts/likes: `apps/api/src/posts/posts.controller.ts`,
    `apps/api/src/likes/likes.controller.ts`
  - Generated spec: `apps/api/openapi.json` (via script)
- Web consumes generated types for key post/like shapes:
  - Generated types: `apps/web/lib/generated/api.ts`
  - `FeedPost`, `FeedResponse`, `LikeStateResponse` now come from the generated contract: `apps/web/lib/api-client.ts`
- Regeneration is one command:
  - `pnpm run openapi:types` (root `package.json`)

### Next.js 16 upgrade + E2E stabilization fixes

- **Dynamic route params in Next 16 are async:** fix `/[username]` + `/posts/[id]` by awaiting `params` so routes don’t
  intermittently render with `undefined` params (and hit `notFound()`):
  - `apps/web/app/[username]/page.tsx`
  - `apps/web/app/posts/[id]/page.tsx`
- **Same-origin API calls in the browser:** add a lightweight Next Route Handler that proxies `/api/*` to the Nest API
  so client code can use relative `/api/...` without baking a hostname into the bundle:
  - `apps/web/app/api/[...path]/route.ts`
- **Follow/unfollow robustness (hydration-safe):** switch profile follow/unfollow to Server Actions so the interaction
  works reliably in slow hydration environments (mobile E2E):
  - `apps/web/app/[username]/follow-actions.ts`
  - `apps/web/app/[username]/components/ProfileActions.tsx`
- **Action-driven navigation + ErrorBoundary:** ensure the profile page’s local error boundary does not swallow Next’s
  control-flow errors (`NEXT_REDIRECT`, `NEXT_NOT_FOUND`), which would otherwise break Server Action redirects:
  - `apps/web/components/common/ErrorBoundary.tsx`
- **E2E flake reduction:** avoid server-action-triggered route refreshes during Playwright clicks by removing
  `revalidatePath('/feed')` from the create-post action:
  - `apps/web/app/feed/actions.ts`

As of **2025-12-15**, the full quality gate suite passes locally: `pnpm run lint:all`, `pnpm run type-check`,
`pnpm test --watchAll=false`, `pnpm run test:e2e`.

## What “modern React/Next” means in late 2025 (practical patterns)

### React 19 patterns that are current

- **Actions-first forms:** use Server Actions + `useActionState` to keep form submit logic off the client and expose
  pending/error/success state in a standard way.
- **Optimistic UI:** use `useOptimistic` and transitions for responsive interactions during async mutations.
- **Minimize client islands:** default to server components + server fetch; keep `"use client"` limited to interactive
  islands.

Sources:

- React 19 (Actions, `useActionState`, `useOptimistic`): <https://react.dev/blog/2024/12/05/react-19>
- React 19.2: <https://react.dev/blog/2025/10/01/react-19-2>
- `useActionState`: <https://react.dev/reference/react/useActionState>
- `useOptimistic`: <https://react.dev/reference/react/useOptimistic>

### Next.js App Router patterns that are current

- **Server Components default:** fetch on the server; cache/revalidate intentionally.
- **Server Actions for mutations:** treat them like public endpoints (authn/authz, rate limits, demo safety).
- **Upgrade hygiene:** keep a single baseline for Node/pnpm/Next across CI + Docker so “works on my machine” doesn’t
  happen.

Sources:

- Next.js 16 release: <https://nextjs.org/blog/next-16>
- Next.js 16 upgrade guide: <https://nextjs.org/docs/app/guides/upgrading/version-16>
- Server Actions / Server Functions: <https://nextjs.org/docs/app/getting-started/updating-data>

## Hiring signals (what teams screen for)

Trends that show up repeatedly across hiring loops (screen → take-home → onsite):

- **TypeScript-first React** (most teams expect strong TS, not “optional TS”).
- **A framework story:** Next.js is a common default for SSR + routing + data fetching.
- **Shipping ability:** tests, debugging, quality gates, CI habits, and performance/a11y instincts.
- **API boundary discipline:** typed contracts and runtime validation at boundaries reduce drift and incident rates.
- **AI-aware workflows:** expected in practice; the differentiator is judgment + verification, not tool usage.

Sources:

- Stack Overflow Developer Survey 2025 (technology): <https://survey.stackoverflow.co/2025/technology>
- JetBrains State of Developer Ecosystem 2025: <https://www.jetbrains.com/lp/devecosystem-2025/>
- HackerRank Developer Skills Report 2025: <https://www.hackerrank.com/reports/developer-skills-report-2025>
- State of JS 2024 (usage, TS adoption): <https://2024.stateofjs.com/en-US/usage/>
- State of React 2024 (ecosystem snapshot): <https://2024.stateofreact.com/en-US/usage/>

## Repo alignment checklist (as of 2025-12-15)

### Strong alignment

- Modern App Router structure and ergonomics: `apps/web/app/*`
- Server-first route + action-driven mutation flow (feed):
  - `apps/web/app/feed/page.tsx`
  - `apps/web/app/feed/actions.ts`
  - `apps/web/app/feed/Feed.tsx`
- Optimistic interaction pattern (likes):
  - `apps/web/components/posts/LikeButton.tsx`
  - `apps/web/components/posts/like-actions.ts`
- Typed contract generation exists and is consumable:
  - `apps/api/openapi.json`
  - `apps/web/lib/generated/api.ts`

### Gaps worth addressing next (highest ROI)

- Expand OpenAPI response typing beyond posts/likes (comments, users, search) so generated types cover most frontend
  surfaces.
- Convert more routes to server-first data fetching (e.g., post detail still fetches client-side in
  `apps/web/app/posts/[id]/post-detail.tsx`).
- Resolve test warnings:
  - “outdated JSX transform” warning in Jest output
  - Node `--localstorage-file` warning in Jest output
