# ADR 0002: Next.js “standalone” output for production + E2E

## Context

We want:

- Small production images
- Fast cold starts
- A production-like runtime for E2E tests

Next.js supports `output: "standalone"` which generates a self-contained server bundle and minimal `node_modules`.

## Decision

- Use `output: "standalone"` in `apps/web/next.config.mjs`
- Build a production image that runs the standalone server (`apps/web/Dockerfile.prod`)
- Run Playwright against the standalone server in `playwright.config.ts`

## Consequences

- Production image size is reduced vs shipping the entire repo.
- Playwright runs a prod-like web server, catching runtime-only issues earlier.
