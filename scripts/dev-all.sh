#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "${ROOT_DIR}"

pnpm run setup:local
pnpm run dev:db
pnpm --filter @isntgram-ai/shared-types build

# Pick free ports (helps when other projects already bind 3000/3001).
source "${ROOT_DIR}/scripts/pick-ports.sh" >/dev/null

WEB_ORIGIN="http://localhost:${WEB_PORT}"
API_ORIGIN="http://localhost:${API_PORT}"

echo ""
echo "Starting dev servers:"
echo "- Web: ${WEB_ORIGIN}"
echo "- API: ${API_ORIGIN}"
echo ""

concurrently -n web,api -c green,cyan \
  "NEXT_PUBLIC_API_URL=${API_ORIGIN} INTERNAL_API_URL=${API_ORIGIN} NEXTAUTH_URL=${WEB_ORIGIN} NEXT_PUBLIC_APP_URL=${WEB_ORIGIN} pnpm --filter web exec next dev -p ${WEB_PORT}" \
  "PORT=${API_PORT} CORS_ORIGIN=${WEB_ORIGIN} pnpm --filter api start:dev"
