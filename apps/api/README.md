# Isntgram API (NestJS)

NestJS + TypeORM API for the Isntgram portfolio project.

## Local development

From the repo root:

```bash
pnpm run dev:db
cp apps/api/env.example apps/api/.env
echo "JWT_SECRET=$(openssl rand -base64 32)" >> apps/api/.env
pnpm run dev:api
```

Health check: `http://localhost:3001/api/health`

## Key scripts

- `pnpm --filter api start:dev` — dev server (watch)
- `pnpm --filter api build` — compile to `apps/api/dist`
- `pnpm --filter api start:prod` — run `dist/main`
- `pnpm --filter api migrate:prod` — run migrations (`dist/migrate.js`)

## Docs

- Environment variables: `apps/api/env.example` and `ENVIRONMENT.md`
- API surface: `docs/architecture/05-api-specification.md`
- Cheapest deploy: `docs/deployment/firebase-cloud-run.md`
