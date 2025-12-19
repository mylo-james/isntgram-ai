# System Design — Feed Design

## Current approach (fan-out on read)

- Feed query pulls posts for the current user + accounts they follow.
- Uses **cursor-based pagination** on `createdAt` + `id` for stable ordering.

### Query shape

```sql
SELECT posts.*
FROM posts
WHERE authorId IN (viewerId + followedIds)
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

## Future options (if scale demands)

- **Fan-out on write:** push new posts into a precomputed feed table.
- **Hybrid:** precompute for high-fanout users, read-time for others.
- **Caching:** cache first page for authenticated sessions.
