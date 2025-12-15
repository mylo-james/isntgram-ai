# Interview Kit

This folder is a lightweight “talk track” for interviews: what to demo, what to highlight, and what tradeoffs were made.

## Quick links

- Architecture overview: `docs/interview/architecture.md`
- Key tradeoffs: `docs/interview/tradeoffs.md`
- Scaling plan: `docs/interview/scaling.md`
- Security notes: `docs/interview/security.md`
- 5-minute demo script: `docs/interview/demo-script.md`

## Recommended interview flow (10–15 minutes)

1. **Show the product path** (demo script): auth → feed → post detail → search → profile
2. **Explain the auth boundary**: NextAuth session on the web; API uses JWT bearer derived from credentials sign-in
3. **Show the quality gates**: unit/integration tests + E2E + CI security scans
4. **Describe the “next step” plan**: feed ranking, caching, background jobs, and hardening items

## Commands to keep handy

```bash
pnpm run lint:all
pnpm run type-check
pnpm test --watchAll=false
pnpm run test:e2e
```
