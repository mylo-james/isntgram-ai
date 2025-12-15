# ADR 0003: GHCR images + Docker Compose deploy on a small VM

## Context

For a portfolio deployment we want:

- Minimal ops overhead
- Repeatable deploys
- The ability to deploy without a platform-specific adapter

## Decision

- CI builds and pushes two images to GHCR:
  - `ghcr.io/<owner>/<repo>-web:<tag>`
  - `ghcr.io/<owner>/<repo>-api:<tag>`
- A VM deployment uses:
  - `docker-compose.deploy.yml`
  - Caddy as a reverse proxy with automatic TLS (`docker/caddy/Caddyfile`)
- Optional deploy job in `.github/workflows/ci.yml` (requires secrets)

## Consequences

- Deploys are reproducible and “infra-lite”.
- Rollbacks are simple (pin `IMAGE_TAG` to a previous SHA).
