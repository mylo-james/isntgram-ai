# System Design — Scaling Roadmap

## 1× (today)

- Single Postgres instance
- Stateless API + Web containers
- Cursor pagination on feed queries

## 10×

- Add read replicas for Postgres
- Introduce basic caching for hot feeds
- Add CDN for media URLs
- Move to object storage with lifecycle policies
- Add AI cost controls (rate limits, budgets, provider timeouts)

## 100×

- Partition feed workload (fan-out on write or hybrid)
- Add background jobs for media processing
- Use a dedicated queue (e.g., SQS, RabbitMQ)
- Service-level rate limits and abuse detection
- Split AI into a dedicated service (queue + worker pool, per-tenant budgets)

## Principles

- Scale only where measured bottlenecks appear
- Keep data ownership clear (Postgres is the source of truth)
- Avoid adding infrastructure before the product needs it
