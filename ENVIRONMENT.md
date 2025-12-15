# Environment Configuration

This document describes the environment variables needed for the Isntgram AI application.

## Backend Environment Variables (apps/api/.env)

```bash
# Server
PORT=3001
HOST=0.0.0.0
NODE_ENV=development

# Database
# The API uses DATABASE_URL directly.
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/isntgram
DB_SSL=false

# Auth
# Required in all non-test environments
JWT_SECRET=
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:3000

# Throttling (applies to endpoints guarded by ThrottlerGuard)
THROTTLE_TTL=60000
THROTTLE_LIMIT=10

# Demo user (non-sensitive placeholders)
DEMO_EMAIL=demo@isntgram.ai
DEMO_USERNAME=demo
DEMO_FULL_NAME=Demo User
DEMO_PASSWORD=changeme

# AI (optional)
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

# Observability (optional)
SENTRY_DSN=
SENTRY_TRACES_SAMPLE_RATE=0

# Optional: boot API without DB-backed feature modules
SKIP_DB=false

# Logging
# In production, HTTP request logging is enabled by default.
# Set to `true` to enable it in non-production environments.
LOG_REQUESTS=false
```

## Frontend Environment Variables (apps/web/.env.local)

```bash
# API
# In local dev we run the API on a separate port, so this must be set.
# In production, you can omit it and the browser will use same-origin `/api/*` calls.
NEXT_PUBLIC_API_URL=http://localhost:3001
# Server-side requests can use an internal URL (e.g. http://api:3001 in Docker)
INTERNAL_API_URL=http://localhost:3001

# Auth.js / NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
# Must be provided securely; do not commit real secrets (required in production)
NEXTAUTH_SECRET=
# Alias used by our NextAuth config; if unset we fall back to NEXTAUTH_SECRET.
AUTH_SECRET=

# Demo Mode
NEXT_PUBLIC_DEMO_EMAIL=demo@isntgram.ai
NEXT_PUBLIC_DEMO_PASSWORD=changeme
DEMO_SESSION_MAX_AGE_SECONDS=3600

# Observability (optional)
# Server-side (Next.js) DSN
SENTRY_DSN=
SENTRY_TRACES_SAMPLE_RATE=0
# Client-side DSN (public)
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0
```

## Development Setup

1. Copy the environment variables above into the respective `.env` files
2. Update the values according to your local development setup
3. Never commit actual `.env` files to version control
4. Update this documentation when adding new environment variables

## Production Notes

- Use strong, unique secrets for `JWT_SECRET` and `NEXTAUTH_SECRET`
- Configure proper database credentials (and use a managed DB for production)
- Ensure `NODE_ENV=production` in production environments
