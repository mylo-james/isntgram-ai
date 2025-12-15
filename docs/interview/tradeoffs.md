# Key Tradeoffs

## NextAuth session + API JWT bearer

Decision: web uses NextAuth for session UX; API uses JWT bearer for authorization.

- Pros:
  - Clear auth boundary for the API (no cookie/session coupling)
  - Easy to run E2E against a prod-like web server + API
  - Clean path-based routing in production (`/auth/*` vs `/api/*`)
- Cons:
  - Two “auth concepts” to explain (web session vs API bearer)
  - Requires careful token handling (kept server-side; never stored in localStorage)

## Denormalized counters

Decision: store counts on `users` and `posts` (followers, likes, comments) instead of aggregating every request.

- Pros: faster reads, simpler UI
- Cons: requires careful transactional updates and backfill strategies if drift occurs

## Search implementation

Decision: simple substring search (`LIKE`) with a hashtag convention.

- Pros: straightforward and demo-friendly; no extra infrastructure
- Cons: not scalable for large datasets; no ranking; limited language support

## AI integration

Decision: optional server-side AI captions feature (OpenAI Responses API + structured outputs).

- Pros: safe (no client secrets), deterministic response shape, easy to demo
- Cons: cost-bearing and quota-sensitive; requires defensive error handling

## Production runtime

Decision: Next.js `output: "standalone"` and per-app production Dockerfiles.

- Pros: smaller images; faster cold starts; E2E runs against prod-like artifacts
- Cons: slightly more complex build pipeline and file-tracing considerations in monorepos
