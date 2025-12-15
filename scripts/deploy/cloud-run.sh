#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-mjames-dev}"
REGION="${REGION:-us-central1}"
AR_REPO="${AR_REPO:-isntgram}"

WEB_SERVICE="${WEB_SERVICE:-isntgram-web}"
API_SERVICE="${API_SERVICE:-isntgram-api}"

TAG="${TAG:-$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)}"

# Public web origin (used for CORS + NextAuth URL)
# Tip: deploy to the Firebase default domain first (e.g. https://isntgram.web.app),
# then switch to your custom domain once DNS is connected.
WEB_DOMAIN="${WEB_DOMAIN:-https://isntgram.web.app}"

# API runtime configuration
DB_SSL="${DB_SSL:-true}"
THROTTLE_TTL="${THROTTLE_TTL:-60000}"
THROTTLE_LIMIT="${THROTTLE_LIMIT:-10}"
OPENAI_MODEL="${OPENAI_MODEL:-gpt-4o-mini}"
DEMO_ALLOW_AI="${DEMO_ALLOW_AI:-false}"

# Migrations
RUN_MIGRATIONS="${RUN_MIGRATIONS:-true}"
MIGRATE_JOB="${MIGRATE_JOB:-isntgram-migrate}"

# Secret Manager names (override if desired)
SM_DATABASE_URL_SECRET="${SM_DATABASE_URL_SECRET:-ISNTGRAM_DATABASE_URL}"
SM_JWT_SECRET_SECRET="${SM_JWT_SECRET_SECRET:-ISNTGRAM_JWT_SECRET}"
SM_NEXTAUTH_SECRET_SECRET="${SM_NEXTAUTH_SECRET_SECRET:-ISNTGRAM_NEXTAUTH_SECRET}"
SM_AUTH_SECRET_SECRET="${SM_AUTH_SECRET_SECRET:-ISNTGRAM_AUTH_SECRET}"
SM_OPENAI_API_KEY_SECRET="${SM_OPENAI_API_KEY_SECRET:-ISNTGRAM_OPENAI_API_KEY}"

# Runtime service account (used by Cloud Run services + migration job).
# Defaults to the project's Compute Engine default service account.
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_EMAIL:-}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "❌ Missing required command: $1" >&2
    exit 1
  fi
}

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "❌ Missing required env var: $name" >&2
    exit 1
  fi
}

urlencode() {
  node -e 'process.stdout.write(encodeURIComponent(process.argv[1] ?? ""))' "${1:-}"
}

create_or_update_secret() {
  local name="$1"
  local value="$2"

  if ! gcloud secrets describe "$name" --project "$PROJECT_ID" >/dev/null 2>&1; then
    gcloud secrets create "$name" --project "$PROJECT_ID" --replication-policy="automatic" >/dev/null
  fi

  printf %s "$value" | gcloud secrets versions add "$name" --project "$PROJECT_ID" --data-file=- >/dev/null
}

require_cmd gcloud
require_cmd node

require_env DATABASE_URL
require_env JWT_SECRET
require_env NEXTAUTH_SECRET

# If DATABASE_URL contains a placeholder like `[SUPABASE_PASSWORD]`, substitute it safely.
if [[ "$DATABASE_URL" == *"[SUPABASE_PASSWORD]"* ]]; then
  require_env SUPABASE_PASSWORD
  ENCODED_SUPABASE_PASSWORD="$(urlencode "$SUPABASE_PASSWORD")"
  DATABASE_URL="${DATABASE_URL//\\[SUPABASE_PASSWORD\\]/$ENCODED_SUPABASE_PASSWORD}"
fi

AUTH_SECRET_VALUE="${AUTH_SECRET:-$NEXTAUTH_SECRET}"

echo "🔧 Target project: $PROJECT_ID"
gcloud config set project "$PROJECT_ID" >/dev/null

echo "🧩 Enabling required APIs…"
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com >/dev/null

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
RUNTIME_SA="${SERVICE_ACCOUNT_EMAIL:-${PROJECT_NUMBER}-compute@developer.gserviceaccount.com}"

echo "🔑 Ensuring Secret Manager access for runtime SA: $RUNTIME_SA"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet >/dev/null

echo "📦 Ensuring Artifact Registry repo exists: $AR_REPO ($REGION)…"
if ! gcloud artifacts repositories describe "$AR_REPO" --location "$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$AR_REPO" \
    --repository-format=docker \
    --location "$REGION" \
    --description="Isntgram containers" >/dev/null
fi

API_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$AR_REPO/$API_SERVICE:$TAG"
WEB_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$AR_REPO/$WEB_SERVICE:$TAG"

echo "🐳 Building API image (Cloud Build): $API_IMAGE"
gcloud builds submit \
  --project "$PROJECT_ID" \
  --config "cloudbuild/dockerfile.yaml" \
  --substitutions "_DOCKERFILE=apps/api/Dockerfile.prod,_IMAGE=$API_IMAGE" \
  . >/dev/null

echo "🐳 Building Web image (Cloud Build): $WEB_IMAGE"
gcloud builds submit \
  --project "$PROJECT_ID" \
  --config "cloudbuild/dockerfile.yaml" \
  --substitutions "_DOCKERFILE=apps/web/Dockerfile.prod,_IMAGE=$WEB_IMAGE" \
  . >/dev/null

echo "🏷️  Tagging images as :latest"
gcloud artifacts docker tags add "$API_IMAGE" "$REGION-docker.pkg.dev/$PROJECT_ID/$AR_REPO/$API_SERVICE:latest" >/dev/null
gcloud artifacts docker tags add "$WEB_IMAGE" "$REGION-docker.pkg.dev/$PROJECT_ID/$AR_REPO/$WEB_SERVICE:latest" >/dev/null

echo "🔐 Writing secrets to Secret Manager (new versions)…"
create_or_update_secret "$SM_DATABASE_URL_SECRET" "$DATABASE_URL"
create_or_update_secret "$SM_JWT_SECRET_SECRET" "$JWT_SECRET"
create_or_update_secret "$SM_NEXTAUTH_SECRET_SECRET" "$NEXTAUTH_SECRET"
create_or_update_secret "$SM_AUTH_SECRET_SECRET" "$AUTH_SECRET_VALUE"

OPENAI_API_KEY_VALUE="${OPENAI_API_KEY:-}"
if [[ -n "$OPENAI_API_KEY_VALUE" ]]; then
  create_or_update_secret "$SM_OPENAI_API_KEY_SECRET" "$OPENAI_API_KEY_VALUE"
fi

echo "🚀 Deploying API to Cloud Run: $API_SERVICE"
gcloud run deploy "$API_SERVICE" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --image "$API_IMAGE" \
  --allow-unauthenticated \
  --service-account "$RUNTIME_SA" \
  --port 3001 \
  --set-secrets "DATABASE_URL=${SM_DATABASE_URL_SECRET}:latest,JWT_SECRET=${SM_JWT_SECRET_SECRET}:latest${OPENAI_API_KEY_VALUE:+,OPENAI_API_KEY=${SM_OPENAI_API_KEY_SECRET}:latest}" \
  --set-env-vars "NODE_ENV=production,DB_SSL=${DB_SSL},CORS_ORIGIN=${WEB_DOMAIN},THROTTLE_TTL=${THROTTLE_TTL},THROTTLE_LIMIT=${THROTTLE_LIMIT},OPENAI_MODEL=${OPENAI_MODEL},DEMO_ALLOW_AI=${DEMO_ALLOW_AI}" >/dev/null

API_URL="$(gcloud run services describe "$API_SERVICE" --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')"
if [[ -z "$API_URL" ]]; then
  echo "❌ Unable to read Cloud Run API URL for $API_SERVICE" >&2
  exit 1
fi

if [[ "$RUN_MIGRATIONS" == "true" ]]; then
  echo "🗄️  Running migrations (Cloud Run Job): $MIGRATE_JOB"

  JOB_FLAGS=(
    --project "$PROJECT_ID"
    --region "$REGION"
    --image "$API_IMAGE"
    --command node
    --args dist/migrate.js
    --service-account "$RUNTIME_SA"
    --set-secrets "DATABASE_URL=${SM_DATABASE_URL_SECRET}:latest"
    --set-env-vars "NODE_ENV=production,DB_SSL=${DB_SSL}"
  )

  if gcloud run jobs describe "$MIGRATE_JOB" --project "$PROJECT_ID" --region "$REGION" >/dev/null 2>&1; then
    gcloud run jobs update "$MIGRATE_JOB" "${JOB_FLAGS[@]}" >/dev/null
  else
    gcloud run jobs create "$MIGRATE_JOB" "${JOB_FLAGS[@]}" >/dev/null
  fi

  gcloud run jobs execute "$MIGRATE_JOB" --project "$PROJECT_ID" --region "$REGION" --wait >/dev/null
  echo "✅ Migrations complete"
fi

echo "🚀 Deploying Web to Cloud Run: $WEB_SERVICE"
gcloud run deploy "$WEB_SERVICE" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --image "$WEB_IMAGE" \
  --allow-unauthenticated \
  --service-account "$RUNTIME_SA" \
  --port 3000 \
  --set-secrets "NEXTAUTH_SECRET=${SM_NEXTAUTH_SECRET_SECRET}:latest,AUTH_SECRET=${SM_AUTH_SECRET_SECRET}:latest" \
  --set-env-vars "NODE_ENV=production,NEXTAUTH_URL=${WEB_DOMAIN},INTERNAL_API_URL=${API_URL},DEMO_SESSION_MAX_AGE_SECONDS=3600" >/dev/null

WEB_URL="$(gcloud run services describe "$WEB_SERVICE" --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')"

echo ""
echo "✅ Deployed"
echo "- API: $API_URL"
echo "- Web: $WEB_URL"
echo ""
echo "Next:"
echo "- Deploy Firebase Hosting rewrites: firebase deploy --only hosting:isntgram --project $PROJECT_ID"
echo "- Verify: https://isntgram.web.app/health and https://isntgram.web.app/api/health"
