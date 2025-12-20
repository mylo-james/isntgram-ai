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
- Token revocation via `tokenVersion` (logout invalidates existing API JWTs)
- Auth.js session lifetime aligned with API JWT expiry to prevent silent session drift
- Public profile responses exclude email
- Strong password validation (argon2id)
- Normalized identifiers (emails/usernames) at the API boundary
- Request rate limiting via NestJS throttler (auth + AI + media)
- Helmet security headers
- Web security headers (nosniff, frame-ancestors, referrer policy)
- Structured error responses without stack traces
- Postgres TLS is supported and certificate verification is enabled by default in production
- AI requests are authenticated and sent server-side (no API keys or provider calls from the browser)
- Media uploads are presigned with short TTLs and validated content type + size

## Next steps (if needed)

- Add audit logs for sensitive operations
- Add email verification / password reset
- Implement account lockouts on failed logins
- Add AI abuse controls (prompt/response logging redaction, cost caps, global budgets)
- Add malware scanning for uploads if supporting public file sharing at scale
