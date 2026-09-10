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
- `DATABASE_DIRECT_URL` (non-pooled, migration and maintenance only)
- `DEPLOYMENT_ENV` (named preview or production target)
- `DATABASE_SSL` (recommended for managed Postgres; set `false` for local Postgres container)
- `DATABASE_SSL_REJECT_UNAUTHORIZED` (recommended `true` when TLS is enabled)
- `DATABASE_SSL_CA` (optional; PEM string for custom CA bundles)
- `JWT_SECRET`
- `CORS_ORIGIN`
- `S3_BUCKET`
- `S3_PENDING_BUCKET` (private browser-upload target)
- `S3_PUBLISHED_BUCKET` (public validated-media target)
- `S3_REGION`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_PUBLIC_BASE_URL`
- `S3_ENDPOINT` (only for MinIO / local dev)

### Database migrations

- **Non-production:** the API auto-runs migrations on boot to keep local/dev/CI flows simple.
- **Production:** run migrations as an explicit deploy step (one-shot job) before rolling out new API instances. The
  runner requires `DATABASE_DIRECT_URL`, acquires the environment maintenance lock, and checks durable TypeORM migration
  records after a retryable connection failure.

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
- `BFF_PROXY_SECRET` (a server-only, at-least-32-character value shared with the API in each deployment environment). On
  Vercel, the web server signs only the provider-owned `x-vercel-forwarded-for` address for API forwarding. The API
  rejects stale or invalid signatures and uses its provider-resolved address for direct requests.
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

Cleanup is environment-scoped and records deletion intents before database removal. It retries object deletion from the
pending and published buckets, and must use the direct connection.

The `.github/workflows/demo-cleanup.yml` and `.github/workflows/deployment-backup.yml` workflows are the
daily 08:17 UTC cleanup and daily 03:43 UTC backup entry points. They do nothing until the repository variable
`ISNTGRAM_MAINTENANCE_ENABLED` is explicitly `true`. The scheduled workflow selects its named target through
`ISNTGRAM_MAINTENANCE_ENVIRONMENT`; manual dispatch selects `preview` or `production`. Each protected GitHub Environment
holds its own `ISNTGRAM_DEPLOYED_RECORD` JSON variable and scoped database/storage secrets. The record binds source SHA
and configuration revision in one update. The SHA is validated as a 40-character commit before checkout, so maintenance
never implicitly uses the default branch. GitHub schedules execute only after the reviewed workflow reaches the
repository default branch; a draft candidate does not activate it.

The cleanup freshness cutoff defaults to 27 hours, giving the daily schedule a three-hour margin. Set
`CLEANUP_STALE_AFTER_SECONDS` only to tighten that cutoff; values above 97,200 seconds are capped. Deploy the
matching API before changing a live hourly schedule to daily, so the previous three-hour guard does not pause
new demos and uploads. The two workflows share the enable variable: keep the backup workflow disabled in GitHub
unless backup operation is separately configured and intended. Changing the cleanup cadence does not enable backups.

Cleanup uses `CLEANUP_S3_ACCESS_KEY_ID` and `CLEANUP_S3_SECRET_ACCESS_KEY`. Backup uses separate
`BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`, and `BACKUP_ENCRYPTION_KEY_BASE64`; no workflow uploads backup
bytes or secrets as Actions artifacts. Backup also requires an environment-scoped `PG_CLIENT_MAJOR` value and refuses to
run if the installed client does not match. Both workflows share the environment maintenance concurrency group with
`cancel-in-progress: false`; the database advisory lock remains the guard for manual or release paths outside Actions.

## Canonical release and maintenance identity

`ISNTGRAM_WEB_ALIAS` must be exactly `isntgram-preview.mjames.dev` for preview or
`isntgram.mjames.dev` for production. `ISNTGRAM_API_ORIGIN` is the selected API
project's stable HTTPS `*.vercel.app` origin; `ISNTGRAM_API_ALIAS` must equal its
hostname. Distinct project IDs and exact aliases are checked before effects and
bound into the stage receipt. Promotion rechecks these values and each resulting
canonical deployment identity after native provider operations.

`ISNTGRAM_DEPLOYED_RECORD` describes API maintenance provenance, not whole-app
acceptance. Its version 1 fields are `scope: "api"`, `sourceSha`, `configRevision`,
`apiDeploymentId` and `releaseState`. Before any canonical promotion, the release
writes `promotion-pending`; scheduled cleanup/backup refuse that state. An unknown
or failed API promotion therefore requires read-only reconciliation and an explicit
operator recovery instead of running maintenance against assumed provenance.
After verified API promotion and health it becomes `api-serving`. If web promotion
then fails, maintenance still follows the verified serving API and the release is
incomplete. Only after both canonical units pass does it become `pair-healthy`.
Each transition writes and verifies one JSON record. Initial bootstrap must provide
this complete record for the actual API deployment. These states do not authorize
any provider operation or substitute for the workflow's actual outcome.

Source qualification requires successful Code Quality, Coverage Gate, Integration
Tests, E2E Tests, Production Build and Security Scans jobs, plus successful independent
CodeQL and gitleaks results from GitHub Advanced Security for the exact source SHA.
The latest result for each required name must pass. A successful scan job does not
mean its separate security findings check passed; missing, skipped, pending and failed
results all stop release. Deployment needs read-only check access for this verification.
