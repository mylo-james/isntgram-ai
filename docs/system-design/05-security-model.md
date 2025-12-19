# System Design — Security Model

## Threat model highlights

- **Broken Object Level Authorization (BOLA)**
- **Credential stuffing / brute force**
- **PII exposure (email, tokens)**
- **Insecure direct object access**

## Mitigations in this repo

- JWT auth guard on all private endpoints
- Server-side token handling via BFF (no client token leakage)
- Public profile responses exclude email
- Strong password validation (argon2id)
- Request rate limiting via NestJS throttler
- Helmet security headers
- Structured error responses without stack traces
- AI requests are authenticated and sent server-side (no API keys or provider calls from the browser)

## Next steps (if needed)

- Add audit logs for sensitive operations
- Add email verification / password reset
- Implement account lockouts on failed logins
- Add AI abuse controls (rate limits, prompt/response logging redaction, cost caps)
