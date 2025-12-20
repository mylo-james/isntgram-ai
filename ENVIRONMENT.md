# Environment Configuration

This document describes the environment variables needed for the Isntgram AI application.

## Backend Environment Variables (apps/api/.env)

```bash
# Server
NODE_ENV=development
HOST=0.0.0.0
PORT=3001

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/isntgram

# Database TLS (recommended for managed Postgres)
# - Defaults: enabled in production, disabled otherwise
DATABASE_SSL=false
# Verify server certificate when TLS is enabled (recommended)
DATABASE_SSL_REJECT_UNAUTHORIZED=true
# Optional PEM string for custom CA bundles (managed DBs may provide one)
DATABASE_SSL_CA=

# Auth
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:3000

# Demo mode (optional)
DEMO_ENABLED=true
DEMO_EMAIL=demo@isntgram.ai
DEMO_USERNAME=demo
DEMO_FULL_NAME=Demo User
DEMO_PASSWORD=demo

# Media storage (S3-compatible)
S3_BUCKET=isntgram-media
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_ENDPOINT=http://localhost:9000
S3_PUBLIC_BASE_URL=http://localhost:9000/isntgram-media
MEDIA_ALLOWED_HOSTS=cdn.isntgram.ai,localhost:9000,127.0.0.1:9000
MEDIA_MAX_UPLOAD_BYTES=5242880

# Note: The web app uses `next/image`. Keep `NEXT_PUBLIC_MEDIA_HOSTS` aligned with `S3_PUBLIC_BASE_URL`
# and any additional CDN hosts.

# Logging
REQUEST_LOGGING=true
METRICS_ENABLED=true

# Observability
# Metrics endpoint: GET /api/metrics (disabled when NODE_ENV=test or METRICS_ENABLED=false)

# Rate limiting
THROTTLER_TTL=60000
THROTTLER_LIMIT=10

# AI (optional)
# Options: mock | openai
AI_PROVIDER=mock
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

## Frontend Environment Variables (apps/web/.env.local)

```bash
# API configuration
NEXT_PUBLIC_API_URL=http://localhost:3001
INTERNAL_API_URL=http://localhost:3001

# Auth.js
AUTH_SECRET=your-auth-secret-change-this-in-production
NEXTAUTH_URL=http://localhost:3000
# Align Auth.js session lifetime with API JWT expiry (seconds or 7d/24h/60m)
AUTH_SESSION_MAX_AGE=7d
# Optional explicit origin for CSRF origin checks
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Media hosts for next/image (comma-separated host[:port] or full URLs)
NEXT_PUBLIC_MEDIA_HOSTS=localhost:9000,127.0.0.1:9000,cdn.isntgram.ai
# Max upload size hint for the UI (bytes)
NEXT_PUBLIC_MEDIA_MAX_UPLOAD_BYTES=5242880

# Note: keep MEDIA_MAX_UPLOAD_BYTES and NEXT_PUBLIC_MEDIA_MAX_UPLOAD_BYTES aligned.

# Demo helper
NEXT_PUBLIC_DEMO_ENABLED=true
NEXT_PUBLIC_DEMO_EMAIL=demo@isntgram.ai
NEXT_PUBLIC_DEMO_PASSWORD=demo
```

## Development Setup

1. Copy the example environment files:

   ```bash
   cp apps/api/env.example apps/api/.env
   cp apps/web/env.example apps/web/.env.local
   ```

2. Update values for your local setup.
3. Never commit actual `.env` files to version control.
4. Keep this document updated when adding or removing variables.

## Production Notes

- Use strong, unique secrets for `JWT_SECRET` and `AUTH_SECRET`.
- Always set `CORS_ORIGIN` to your web URL.
- For media uploads, point the S3 variables to your bucket/CDN.
- Consider disabling demo mode in production by omitting `DEMO_ENABLED` or setting it to `false`.
