# Deployment Runbook (Docker Compose + Caddy + GHCR)

This repo ships production images for **web** and **api** to GitHub Container Registry (GHCR) and can be deployed on a
small VM with Docker Compose.

## Prerequisites

- A Linux VM with Docker + Docker Compose v2 installed
- DNS records for:
  - `WEB_DOMAIN` (e.g. `isntgram.mjames.dev`) → VM public IP
- A managed Postgres database (recommended) and its `DATABASE_URL`
- A GHCR token with `read:packages` permission

## 1) Server bootstrap (one-time)

On the server:

```bash
sudo mkdir -p /opt/isntgram
sudo chown -R $USER:$USER /opt/isntgram
cd /opt/isntgram
```

Copy these files from the repo to the server (via `scp`, `rsync`, etc.):

- `docker-compose.deploy.yml`
- `docker/caddy/Caddyfile`

Create `/opt/isntgram/.env`:

```bash
# Image source
GITHUB_REPOSITORY=OWNER/REPO
IMAGE_TAG=latest

# Domains (Caddy)
WEB_DOMAIN=isntgram.mjames.dev

# Web
NEXTAUTH_URL=https://isntgram.mjames.dev
NEXTAUTH_SECRET=REPLACE_WITH_STRONG_RANDOM
AUTH_SECRET=REPLACE_WITH_STRONG_RANDOM
INTERNAL_API_URL=http://api:3001
# Optional observability (used by both web and api services)
SENTRY_DSN=
SENTRY_TRACES_SAMPLE_RATE=0

# API
DATABASE_URL=postgresql://...
DB_SSL=true
JWT_SECRET=REPLACE_WITH_STRONG_RANDOM
CORS_ORIGIN=https://isntgram.mjames.dev
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

# Optional throttling
THROTTLE_TTL=60000
THROTTLE_LIMIT=10

# Demo user (optional overrides)
DEMO_EMAIL=demo@isntgram.ai
DEMO_PASSWORD=changeme
```

Note: `SENTRY_DSN` enables server-side error tracking for both services at runtime. Client-side Sentry (browser) uses
`NEXT_PUBLIC_SENTRY_DSN`, which is baked into the web bundle at build time; enabling it for GHCR images requires
rebuilding the web image with that build arg.

Login to GHCR (one-time, or as part of deploy):

```bash
docker login ghcr.io
```

## 2) Deploy / update

From `/opt/isntgram`:

```bash
# Pull latest images
docker compose -f docker-compose.deploy.yml pull

# Run migrations (safe to re-run)
docker compose -f docker-compose.deploy.yml run --rm api-migrate

# Restart services
docker compose -f docker-compose.deploy.yml up -d --remove-orphans
```

Verify:

```bash
curl -f http://localhost:3001/api/health
```

You should also verify externally:

- Web: `https://isntgram.mjames.dev/health`
- API: `https://isntgram.mjames.dev/api/health`

## 3) Rollback

Set `IMAGE_TAG` to a previous SHA and redeploy:

```bash
export IMAGE_TAG=<previous-sha>
docker compose -f docker-compose.deploy.yml pull
docker compose -f docker-compose.deploy.yml run --rm api-migrate
docker compose -f docker-compose.deploy.yml up -d --remove-orphans
```
