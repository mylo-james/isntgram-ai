# System Design — Security Model

## Threat model highlights

- **Broken Object Level Authorization (BOLA)**
- **Credential stuffing / brute force**
- **PII exposure (email, tokens)**
- **Insecure direct object access**

## Mitigations in this repo

- JWT auth guard on all private endpoints
- Server-side token handling via BFF (no client token leakage)
- CSRF protection on BFF state-changing routes (double submit + origin checks)
- CSRF token rotation (short TTL) to reduce reuse window
- CSRF config fails closed in production if origin allowlist is missing/misconfigured
- Token revocation via `tokenVersion` (logout invalidates existing API JWTs)
- Auth.js session lifetime aligned with API JWT expiry to prevent silent session drift
- Auth.js host trust is explicitly configurable via `AUTH_TRUST_HOST` when deploying behind proxies
- Public profile responses exclude email
- Strong password validation (argon2id)
- Normalized identifiers (emails/usernames) at the API boundary
- Request rate limiting via NestJS throttler (per-route policies; keyed by user ID when authenticated)
- Helmet security headers
- Web security headers (nosniff, frame-ancestors, referrer policy)
- Structured error responses without stack traces
- Postgres TLS is supported and certificate verification is enabled by default in production
- Media uploads are presigned with short TTLs and validated content type + size

## Next steps (if needed)

- Add audit logs for sensitive operations
- Add email verification / password reset
- Implement account lockouts on failed logins
- Add malware scanning for uploads if supporting public file sharing at scale
