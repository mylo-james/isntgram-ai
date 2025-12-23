#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "${ROOT_DIR}"

pnpm run setup:local
pnpm run dev:db

# Pick ports before building so production-mode CSRF origin allowlists match.
source "${ROOT_DIR}/scripts/pick-ports.sh" >/dev/null

WEB_ORIGIN="http://localhost:${WEB_PORT}"
API_ORIGIN="http://localhost:${API_PORT}"

echo ""
echo "Building (production-like)..."
NEXT_PUBLIC_API_URL="${API_ORIGIN}" \
  INTERNAL_API_URL="${API_ORIGIN}" \
  NEXTAUTH_URL="${WEB_ORIGIN}" \
  NEXT_PUBLIC_APP_URL="${WEB_ORIGIN}" \
  pnpm run build:all

echo ""
echo "Starting usertest servers:"
echo "- Web: ${WEB_ORIGIN}"
echo "- API: ${API_ORIGIN}"
echo ""

concurrently -n web,api -c green,cyan \
  "NEXT_PUBLIC_API_URL=${API_ORIGIN} INTERNAL_API_URL=${API_ORIGIN} NEXTAUTH_URL=${WEB_ORIGIN} NEXT_PUBLIC_APP_URL=${WEB_ORIGIN} pnpm --filter web exec next start -p ${WEB_PORT}" \
  "PORT=${API_PORT} CORS_ORIGIN=${WEB_ORIGIN} pnpm --filter api start:prod"
