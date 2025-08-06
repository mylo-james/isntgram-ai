# Environment Configuration

This document describes the environment variables needed for the Isntgram AI application.

## Backend Environment Variables (apps/api/.env)

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_NAME=isntgram

# Application Configuration
NODE_ENV=development
PORT=3000

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# AWS S3 Configuration (for image storage)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=isntgram-images
```

## Frontend Environment Variables (apps/web/.env.local)

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000

# Auth.js Configuration
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your-nextauth-secret-change-this-in-production

# Database URL (for Auth.js)
DATABASE_URL=postgresql://postgres:password@localhost:5432/isntgram
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
