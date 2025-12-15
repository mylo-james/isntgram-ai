# ADR 0004: AI Caption Suggestions (OpenAI Responses API)

## Context

The portfolio’s “AI” claim should be supported by one **obvious**, end-to-end feature that is:

- Safe (no client-side secrets, demo-safe)
- Cheap to run (rate limited)
- Reliable to integrate (structured outputs)

## Decision

- Add `POST /api/ai/captions` in the NestJS API.
- Call OpenAI’s **Responses API** server-side (via `fetch`) using **structured outputs** (JSON schema) to return:
  - `{ suggestions: string[] }`
- Keep the feature optional:
  - Enable via `OPENAI_API_KEY` (and optional `OPENAI_MODEL`)
- Apply guards to control abuse:
  - `JwtAuthGuard` (auth required)
  - `DemoReadOnlyGuard` (demo blocked)
  - `ThrottlerGuard` (rate limit)
- Surface the feature in the evaluator path:
  - Feed composer shows **AI suggestions** with a tone selector and “Use” actions.

## Consequences

- The repo demonstrates an AI integration without leaking credentials.
- The UI makes the feature discoverable without forcing it on demo users.
- Local/CI tests validate the boundary (provider calls are mocked).
