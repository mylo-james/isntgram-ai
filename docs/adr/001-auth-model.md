# ADR-001: Auth Model (Auth.js + API JWT)

## Status

Accepted — 2025-12-18

## Context

We need a single, coherent auth story for a Next.js App Router frontend and a NestJS API. Prior attempts mixed
client-stored user IDs and multiple auth mechanisms, leading to broken authorization and PII leaks.

## Decision

- **Web:** Auth.js/NextAuth (stable v4) using the Credentials provider.
- **API:** NestJS issues JWT access tokens on `/api/auth/login`.
- **Token handling:** The web stores the API JWT inside the **encrypted Auth.js JWT cookie** (HTTP-only). The **browser
  session payload does not include** the API token. BFF route handlers read the token server-side and attach
  `Authorization: Bearer <jwt>` on outbound API requests.
- **Session lifetime:** Auth.js session TTL is aligned with API JWT expiry to avoid silent drift.
- **CSRF:** BFF mutations require a rotating double-submit CSRF token and strict origin checks.

## Consequences

- The browser never sends user IDs as proof of identity.
- API authorization is enforced by JWT guards.
- This is simple to reason about, easy to deploy, and aligns with modern Next.js patterns.
