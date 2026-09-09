# System Design — Scaling Triggers & Next Moves

This doc answers: **“What breaks first, how will we know, and what do we change next?”**  
The goal is to show _senior-level judgement_: scale the simplest thing until measurements tell you otherwise.

## Capacity targets (portfolio assumptions)

- **Peak read QPS:** ~200
- **Peak write QPS:** ~20
- **Feed p95:** < 250ms
- **API error rate:** < 1%
- **Media upload failure rate:** < 1–2%

## Global signals we watch

- **API latency:** p50/p95/p99 per route (especially `/posts/feed`, `/posts`, `/follows/*`)
- **API error rate:** 4xx/5xx by route
- **DB health:** CPU, connections, replication lag (if any), query latency
- **Cache hit rate:** (only once we add caching)
- **Media throughput:** presign rate, upload failures, object store latency

## Feed (fan-out on read)

### What breaks first

- Follow graphs grow → the feed query does more work.
- DB becomes the bottleneck before application CPU does.

### Trigger thresholds (examples)

- `/posts/feed` **p95 > 250ms** for 15 minutes at steady traffic.
- Postgres CPU **> 70%** sustained during peak.
- “Big follower” accounts appear (high fan-out) and start dominating reads/writes.

### Next moves (in order)

1. **Cache first page (short TTL)** per user (best ROI, minimal complexity).
2. **Read replica** for feed reads (if DB supports it and app can route reads safely).
3. **Hybrid fan-out**: keep fan-out-on-read for most users, precompute feeds for high-fanout publishers.
4. **Fan-out-on-write** only if needed (complexity: background jobs, consistency, backfill).

## Follows

### What breaks first

- High write contention on follower/following counters under bursty follow/unfollow traffic.

### Triggers

- Follow/unfollow endpoint error rate increases under concurrency.
- Row-level lock contention becomes visible in DB metrics.

### Next moves

1. Keep counters, but enforce idempotency and transactions (already).
2. If contention becomes a real issue, move counters to derived values (background aggregation) or use cached counters
   with periodic reconciliation (only if required by product).

## Media (S3-compatible uploads)

### What breaks first

- Upload failures due to CORS, content-type mismatches, or object store throttling.

### Triggers

- Upload failure rate > 1–2% at steady traffic.
- Object store latency p95 climbs above a few hundred ms.

### Next moves

1. Add CDN in front of public media URLs.
2. Add lifecycle policies (e.g., cleanup for unused uploads).
3. Optional: async processing (thumbnailing, virus scanning) behind a queue.

## Auth

### What breaks first

- Credential stuffing/brute force attempts.
- Spiky login traffic or token validation overhead (usually not the bottleneck).

### Triggers

- Throttler starts rejecting legitimate users in normal use.
- Elevated 401/403/429 rates.

### Next moves

1. Separate rate limits for auth endpoints vs general API.
2. Add lockouts / anomaly detection (IP + account).
3. Add email verification / password reset flows (product-driven).

## Databases & networking

### TLS

- For managed Postgres, **enable TLS and verify certificates** (don’t disable verification by default).
- For local docker-compose Postgres, TLS is commonly disabled; make this explicit via env (`DATABASE_SSL=false`).
