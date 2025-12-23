# System Design — Feed Design

## Current approach (fan-out on read)

- Feed query pulls posts for the current user + accounts they follow.
- Uses **cursor-based pagination** on `createdAt` + `id` for stable ordering.
- Cursor is an opaque base64url token over `createdAt|id` (URL-safe).
- Uses a DB-side subquery for the follow graph (avoids building large `IN (...)` lists in application memory).
- Indexes: `posts(authorId, createdAt)` and `follows(followerId, createdAt)` to keep the hot path efficient.

### Query shape

```sql
SELECT posts.*
FROM posts
WHERE authorId = :viewerId
   OR authorId IN (
     SELECT followingId
     FROM follows
     WHERE followerId = :viewerId
   )
ORDER BY createdAt DESC, id DESC
LIMIT pageSize + 1
```

## Why fan-out on read

- Simple to implement and reason about.
- Works well for early-stage, low-to-moderate scale.
- No background job needed for feed distribution.

## Tradeoffs

- As follow graphs grow, feed queries become heavier.
- Long follow lists can increase query cost.
- Celebrity problem: very high-fanout publishers can dominate query costs.

## Future options (if scale demands)

- **Fan-out on write:** push new posts into a precomputed feed table.
- **Hybrid:** precompute for high-fanout users, read-time for others.
- **Caching:** cache first page for authenticated sessions.
- **Ranking layer:** optional relevance scoring service at higher scale.

## Phased evolution (explicit path)

### Phase 1: Cache the first page

- Add a short‑TTL cache for `/posts/feed` page 1 per user (e.g., 30–120s).
- Invalidate on post creation or follow/unfollow events.

### Phase 2: Hybrid fan‑out

- Precompute feeds for “high‑fanout” publishers (celebs/brands).
- Keep fan‑out‑on‑read for the long tail.

### Phase 3: Fan‑out on write

- Async pipeline + queue to push posts into per‑user timelines.
- Use backfill + replay strategy for new follows and delayed jobs.

## Operational notes

- Use keyset pagination to avoid `OFFSET` performance cliffs.
- Keep feed queries routed to read replicas once added.
- For cache invalidation, favor “invalidate on write” for the author’s followers rather than global purges.
