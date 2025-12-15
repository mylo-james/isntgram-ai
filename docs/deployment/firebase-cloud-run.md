# Deployment Runbook (Firebase Hosting + Cloud Run)

This is the **cheapest + easiest** way to deploy this repo to a custom subdomain like `isntgram.mjames.dev` while
keeping a separate Firebase Hosting site for your existing portfolio.

High-level routing:

- `https://isntgram.mjames.dev/**` → **Cloud Run** service `isntgram-web` (Next.js)
- `https://isntgram.mjames.dev/api/**` → **Cloud Run** service `isntgram-api` (NestJS)

This repo includes `firebase.json` rewrites for that setup.

## Prereqs

- A Firebase project (this repo defaults to `mjames-dev`)
- Firebase Hosting **multi-site** enabled with a site named `isntgram` (see Step 1)
- Google Cloud billing enabled on the project (Cloud Run + Artifact Registry require it)
- A managed Postgres DB (Supabase or Neon free tier are fine)
- Google Cloud SDK (`gcloud`) installed

## 1) Firebase Hosting: create a dedicated site (one-time)

Create a new Hosting site so you don’t overwrite your existing `mjames.dev` deployment:

```bash
firebase hosting:sites:create isntgram --project mjames-dev
```

This repo already contains `.firebaserc` mapping the `isntgram` deploy target → the `isntgram` Hosting site.

## 2) Install and auth `gcloud` (one-time per machine)

Install:

```bash
brew install --cask google-cloud-sdk
```

Auth and target the project:

```bash
gcloud auth login
gcloud config set project mjames-dev
```

Enable required APIs:

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com
```

## 3) Create Artifact Registry repo (one-time)

Pick a region (this runbook uses `us-central1`):

```bash
gcloud artifacts repositories create isntgram \
  --repository-format=docker \
  --location=us-central1 \
  --description="Isntgram containers"
```

If it already exists, this will fail safely.

## 4) Provision Postgres (required)

Create a Postgres database and get a connection string (Supabase works well for a portfolio app):

- `DATABASE_URL=postgresql://...`
- For most managed providers set: `DB_SSL=true`

## 5) Create secrets (recommended)

Export required secrets:

```bash
export DATABASE_URL="postgresql://..."
export JWT_SECRET="$(openssl rand -base64 32)"
export NEXTAUTH_SECRET="$(openssl rand -base64 32)"
export AUTH_SECRET="$NEXTAUTH_SECRET"
```

Tip (Supabase): if you keep a placeholder in your `DATABASE_URL` like `postgresql://postgres:[SUPABASE_PASSWORD]@...`,
export `SUPABASE_PASSWORD` and the deploy script will URL-encode + substitute it automatically:

```bash
export SUPABASE_PASSWORD="..."
```

Optional (AI captions):

```bash
export OPENAI_API_KEY="..."
export DEMO_ALLOW_AI=true
```

The deploy script in Step 6 stores these values in Google Secret Manager as new secret versions (recommended) and uses
them from Cloud Run.

## 6) Deploy Cloud Run services

This repo includes a helper script:

```bash
PROJECT_ID=mjames-dev REGION=us-central1 AR_REPO=isntgram \
  WEB_SERVICE=isntgram-web API_SERVICE=isntgram-api \
  WEB_DOMAIN=https://isntgram.web.app \
  DB_SSL=true OPENAI_MODEL=gpt-4o-mini \
  scripts/deploy/cloud-run.sh
```

Note: `WEB_DOMAIN` must match the domain you’ll use to access the app (it sets `NEXTAUTH_URL` and API `CORS_ORIGIN`).
It’s often easiest to deploy and verify on `https://isntgram.web.app` first, then re-run the script later with
`WEB_DOMAIN=https://isntgram.mjames.dev` after the custom domain is connected.

After deploy, capture the API URL printed by Cloud Run (it’s also visible in the Cloud Run console).

## 7) Run migrations

By default, `scripts/deploy/cloud-run.sh` creates/updates a Cloud Run Job named `isntgram-migrate` and executes it
(`RUN_MIGRATIONS=true`).

If you prefer to run migrations manually (or if you disabled migrations in the deploy script), create a Cloud Run Job
from the API image and run it:

```bash
gcloud run jobs create isntgram-migrate \
  --region us-central1 \
  --image us-central1-docker.pkg.dev/mjames-dev/isntgram/isntgram-api:latest \
  --command node --args dist/migrate.js \
  --set-secrets DATABASE_URL=ISNTGRAM_DATABASE_URL:latest,JWT_SECRET=ISNTGRAM_JWT_SECRET:latest \
  --set-env-vars NODE_ENV=production,DB_SSL=true

gcloud run jobs execute isntgram-migrate --region us-central1
```

If you deploy with a different image tag, update the job image accordingly.

## 8) Deploy Firebase Hosting config

Deploy only the `isntgram` site:

```bash
firebase deploy --only hosting:isntgram --project mjames-dev
```

Verify on the default domain:

- `https://isntgram.web.app/health`
- `https://isntgram.web.app/api/health`

## 9) Connect `isntgram.mjames.dev`

In the Firebase console:

- Hosting → Add custom domain → `isntgram.mjames.dev`
- Attach it to the **`isntgram`** Hosting site
- Follow the DNS instructions (registrar step)

If your DNS is hosted on Cloudflare, see `docs/deployment/custom-domain-cloudflare.md`.

Once DNS propagates, verify:

- `https://isntgram.mjames.dev/health`
- `https://isntgram.mjames.dev/api/health`
