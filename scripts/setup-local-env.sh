#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

API_ENV="${ROOT_DIR}/apps/api/.env"
API_EXAMPLE="${ROOT_DIR}/apps/api/env.example"

WEB_ENV="${ROOT_DIR}/apps/web/.env.local"
WEB_EXAMPLE="${ROOT_DIR}/apps/web/env.example"

echo "Setting up local env files..."

if [[ -f "${API_ENV}" ]]; then
  echo "✅ apps/api/.env already exists"
else
  cp "${API_EXAMPLE}" "${API_ENV}"
  echo "✅ Created apps/api/.env from apps/api/env.example"
fi

if [[ -f "${WEB_ENV}" ]]; then
  echo "✅ apps/web/.env.local already exists"
else
  cp "${WEB_EXAMPLE}" "${WEB_ENV}"
  echo "✅ Created apps/web/.env.local from apps/web/env.example"
fi

echo ""
echo "Next steps:"
echo "  pnpm run dev:db"
echo "  pnpm run dev:all"
echo ""
echo "For production-like local user testing:"
echo "  pnpm run usertest"

