# ADR 0001: Auth Boundary + Demo Read-Only Enforcement

## Context

The API must never allow clients to choose identities for sensitive operations (e.g. “who am I?”, profile updates).
Additionally, the demo account must be **read-only** server-side, not just a UI convention.

## Decision

- “Me” and profile updates derive identity from the JWT subject:
  - `GET /api/users/me`
  - `PUT /api/users/profile`
- A server-side `DemoReadOnlyGuard` blocks mutations for the demo user by email:
  - Applied to mutating endpoints (follow/unfollow, posts, likes, comments, profile updates)

## Consequences

- Prevents IDOR-style bugs where a client can update another user’s data.
- Demo mode remains safe even if a consumer bypasses the UI.
