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
- `JWT_SECRET`
- `CORS_ORIGIN`
- `S3_BUCKET`
- `S3_REGION`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_PUBLIC_BASE_URL`
- `S3_ENDPOINT` (only for MinIO / local dev)
- `AI_PROVIDER` (optional; `mock` or `openai`)
- `OPENAI_API_KEY` (required when `AI_PROVIDER=openai`)
- `OPENAI_MODEL` (optional)

### Web

- `AUTH_SECRET`
- `NEXTAUTH_URL`
- `INTERNAL_API_URL`

## Health checks

- API: `GET /api/health`
- API readiness: `GET /api/ready`
