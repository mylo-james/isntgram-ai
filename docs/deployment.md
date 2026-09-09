# Deployment

This project deploys as two stateless services (Web + API) with a managed Postgres database and S3-compatible object
storage.

## Local production run

```bash
docker compose -f docker-compose.prod.yml up --build
```

- Web: <http://localhost:3000>
- API: <http://localhost:3001>

## Recommended hosting split

- Web: Vercel (Next.js)
- API: Render / Fly.io / Railway (containerized)
- Database: Neon / Supabase / RDS
- Storage: S3 / Cloudflare R2 / Supabase Storage

## Required environment variables

### API

- `DATABASE_URL`
- `DATABASE_SSL` (recommended for managed Postgres; set `false` for local Postgres container)
- `DATABASE_SSL_REJECT_UNAUTHORIZED` (recommended `true` when TLS is enabled)
- `DATABASE_SSL_CA` (optional; PEM string for custom CA bundles)
- `JWT_SECRET`
- `CORS_ORIGIN`
- `S3_BUCKET`
- `S3_REGION`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_PUBLIC_BASE_URL`
- `S3_ENDPOINT` (only for MinIO / local dev)

### Database migrations

- **Non-production:** the API auto-runs migrations on boot to keep local/dev/CI flows simple.
- **Production:** run migrations as an explicit deploy step (one-shot job) before rolling out new API instances.

```bash
node apps/api/dist/run-migrations.js
```

If you are running migrations from a source checkout (with dev dependencies installed), this also works:

```bash
pnpm --filter api migration:run
```

### Web

- `AUTH_SECRET`
- `NEXTAUTH_URL`
- `AUTH_TRUST_HOST` (set `true` behind a reverse proxy; Auth.js can also infer this on some platforms)
- `AUTH_SESSION_MAX_AGE` (aligns session TTL with API JWT expiry)
- `INTERNAL_API_URL`
- `NEXT_PUBLIC_APP_URL` (origin used for CSRF checks; in production CSRF fails closed without an allowlisted origin)
- `NEXT_PUBLIC_MEDIA_HOSTS` (for `next/image` allowlist)
- `NEXT_PUBLIC_MEDIA_MAX_UPLOAD_BYTES` (UI upload hint, bytes)

## Health checks

- API: `GET /api/health`
- API readiness: `GET /api/ready`

## Maintenance

Denormalized counters can be reconciled if they drift:

```bash
pnpm --filter api counts:reconcile
```

Demo users are designed to be disposable and expire after `DEMO_TTL_HOURS`. Clean up expired demo users via:

```bash
ALLOW_PROD_MAINTENANCE=true pnpm --filter api demo:cleanup
```
