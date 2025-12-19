# System Design — AI Assist

## What it does

- The post composer includes an **“AI polish”** action that rewrites a draft before publishing.
- The UI shows which provider generated the output (`mock` vs `openai`).

## Request flow

1. Browser calls the same-origin BFF endpoint: `POST /api/bff/ai/rewrite`
2. Next.js reads the encrypted Auth.js JWT cookie server-side and attaches `Authorization: Bearer <api-jwt>`
3. API executes `POST /api/ai/rewrite` behind the JWT guard
4. API calls the configured provider and returns `{ content, provider, model? }`

## API contract

- Request: `{ content: string, tone?: "professional" | "friendly" | "concise", maxLength?: number }`
- Response: `{ content: string, provider: "mock" | "openai", model?: string }`

## Providers

- `AI_PROVIDER=mock` (default): deterministic rewrite for local dev and tests (no external network).
- `AI_PROVIDER=openai`: calls OpenAI’s API using `OPENAI_API_KEY` and `OPENAI_MODEL`.

## Security + privacy notes

- Provider API keys are **never** exposed to the browser (API-only env vars).
- Requests are authenticated (same JWT guard as other private endpoints).
- Prompts/responses are not persisted by default (future: opt-in redacted logging).

## Scaling + cost controls (roadmap)

- Separate rate limits for AI endpoints (stricter than general API).
- Add timeouts, retries with backoff, and per-environment budgets.
- At higher scale, move to async execution (queue + worker pool) for predictable latency.
