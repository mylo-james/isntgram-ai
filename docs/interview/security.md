# Security Notes

## Threats considered

- **IDOR / “update other user” bugs**
  - Identity for sensitive operations is derived from JWT subject (`sub`)
  - Example endpoints:
    - `GET /api/users/me`
    - `PUT /api/users/profile`
- **Credential storage**
  - Passwords are hashed with `argon2id`
- **Input validation**
  - Global `ValidationPipe` with `whitelist` + `forbidNonWhitelisted`
- **Abuse / brute force**
  - API rate limiting via `@nestjs/throttler` (and tighter limits on AI endpoint)
- **XSS**
  - Post content is rendered as text with safe hashtag linking (no HTML injection)
- **Secrets handling**
  - No client-side API keys; AI key is server-side only
  - Production deploys use Secret Manager / env vars (depending on target)

## Demo mode safety

Demo is enforced server-side via `DemoReadOnlyGuard` to prevent “UI bypass” writes.

## Hardening ideas (future)

- Stronger CORS allowlist management (multi-origin deployments)
- Database SSL verification with pinned CA chain where supported
- Refresh token rotation / token revocation list if sessions need to be invalidated early
