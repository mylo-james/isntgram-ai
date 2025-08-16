# Environment Configuration

This document describes the environment variables needed for the Isntgram AI application.

## Backend Environment Variables (apps/api/.env)

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=
DB_NAME=isntgram

# Application Configuration
NODE_ENV=development
PORT=3000

# JWT Configuration
# Must be provided securely; do not commit real secrets
JWT_SECRET=

# AWS S3 Configuration (for image storage)
# Set via environment or secret manager; do not commit real keys
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_S3_BUCKET=isntgram-images
```

## Frontend Environment Variables (apps/web/.env.local)

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000

# Auth.js Configuration
NEXTAUTH_URL=http://localhost:3001
# Must be provided securely; do not commit real secrets
NEXTAUTH_SECRET=

# Database URL (for Auth.js)
# Provide locally via .env with a secure password
DATABASE_URL=postgresql://postgres:${DB_PASSWORD:-postgres}@localhost:5432/isntgram
```

## Development Setup

1. Copy the environment variables above into the respective `.env` files
2. Update the values according to your local development setup
3. Never commit actual `.env` files to version control
4. Update this documentation when adding new environment variables

## Production Notes

- Use strong, unique secrets for JWT_SECRET and NEXTAUTH_SECRET
- Configure proper database credentials
- Set up AWS S3 bucket for image storage
- Ensure NODE_ENV=production in production environments
