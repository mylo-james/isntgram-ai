#!/usr/bin/env bash
set -euo pipefail

pnpm run openapi:types

if ! git diff --exit-code -- apps/api/openapi.json apps/web/lib/generated/api.ts >/dev/null; then
  echo "❌ OpenAPI artifacts are out of date."
  echo "Run: pnpm run openapi:types"
  exit 1
fi

echo "✅ OpenAPI artifacts are up to date"

