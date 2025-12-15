# Scaling Plan (If This Became a Real Product)

## Feed

Current: global “most recent” posts list.

Next steps:

- Personalized feed: `posts` by followed users first
- Add indexes:
  - `follows(followerId, createdAt)`
  - `posts(userId, createdAt)`
  - `post_likes(postId, userId)` (already unique-indexed)
- Consider caching:
  - Read-through cache for feed pages (Redis) with short TTL
  - Precomputed timelines (fan-out) only if necessary

## Search

If search becomes important:

- Postgres full-text search (tsvector) for content
- Trigram indexes for username/fullName
- Add basic ranking and pagination stability

## Background jobs

Introduce a queue (BullMQ / Cloud Tasks / Sidekiq equivalent) for:

- Notifications (likes/comments/follows)
- AI calls (retry + rate limiting + cost controls)
- Periodic reconciliation of denormalized counters

## Observability

- Structured request logs with `requestId` already exist for the API
- Add:
  - latency/error-rate dashboards
  - tracing correlation (Cloud Trace) in production
  - SLOs for `/api/health` and critical endpoints
