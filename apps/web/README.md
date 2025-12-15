# Isntgram Web (Next.js)

Next.js 14 App Router frontend for the Isntgram portfolio project.

## Local development

From the repo root:

```bash
pnpm run dev:db
cp apps/web/env.example apps/web/.env.local
pnpm run dev:web
```

Web: `http://localhost:3000`

## Auth (NextAuth/Auth.js)

- NextAuth is mounted at **`/auth/*`** (not `/api/auth/*`) so `/api/*` can be reserved for the NestJS API.
- Production server requires `NEXTAUTH_SECRET` (or `AUTH_SECRET`). See `apps/web/env.example`.

## Docs

- Evaluator guide: `docs/evaluator-guide.md`
- Cheapest deploy: `docs/deployment/firebase-cloud-run.md`
