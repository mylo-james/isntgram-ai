# System Design — Scaling Roadmap

For concrete “when to do what” thresholds, see `docs/system-design/07-scaling-triggers.md`.

## Baseline assumptions

- **Target MVP load:** 100k DAU, ~200 QPS read / ~20 QPS write at peak.
- **Feed shape:** cursor‑based pages of 20 posts, read‑heavy traffic.
- **Media:** direct-to-object-store uploads, CDN for read if needed.

## 1× (today)

- Single Postgres instance
- Stateless API + Web containers
- Cursor pagination on feed queries
- Basic rate limits (auth + AI + media)

## 10×

- Add read replicas for Postgres
- Introduce basic caching for hot feeds (first page, short TTL)
- Add CDN for media URLs
- Move to object storage with lifecycle policies
- Add AI cost controls (rate limits, budgets, provider timeouts)
- Add connection pooling and slow query alerts

## 100×

- Partition feed workload (hybrid fan‑out, then fan‑out on write if needed)
- Add background jobs for media processing
- Use a dedicated queue (e.g., SQS, RabbitMQ)
- Service-level rate limits and abuse detection
- Split AI into a dedicated service (queue + worker pool, per-tenant budgets)
- Add per-user and per-IP abuse detection with adaptive throttling

## Beyond 100× (only if product demands)

- Dedicated **timeline service** with Redis + queue workers.
- Multi-region read replicas and CDN edge caches.
- Async ranking service for relevance‑based feeds.

## Principles

- Scale only where measured bottlenecks appear
- Keep data ownership clear (Postgres is the source of truth)
- Avoid adding infrastructure before the product needs it
