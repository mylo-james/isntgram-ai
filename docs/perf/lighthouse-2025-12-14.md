# Lighthouse Results (2025-12-14)

_Notes:_

- Local run against `http://localhost:3000` using Playwright Chromium with mobile emulation.
- Authenticated routes were tested by reusing the NextAuth session cookie via `--extra-headers`.

| Route         | Performance | A11y | Best Practices | SEO | FCP   | LCP   | TBT    | CLS   | Speed Index | Report                                                |
| ------------- | ----------: | ---: | -------------: | --: | ----- | ----- | ------ | ----- | ----------- | ----------------------------------------------------- |
| `home`        |          91 |  100 |            100 | 100 | 1.0 s | 3.4 s | 90 ms  | 0.027 | 1.0 s       | `docs/perf/lighthouse-2025-12-14/lh-home.json`        |
| `login`       |          96 |  100 |            100 | 100 | 0.8 s | 2.7 s | 0 ms   | 0.038 | 1.1 s       | `docs/perf/lighthouse-2025-12-14/lh-login.json`       |
| `feed`        |          92 |  100 |            100 | 100 | 0.8 s | 3.3 s | 20 ms  | 0.027 | 1.0 s       | `docs/perf/lighthouse-2025-12-14/lh-feed.json`        |
| `explore`     |          99 |  100 |            100 | 100 | 0.8 s | 2.0 s | 10 ms  | 0.051 | 0.8 s       | `docs/perf/lighthouse-2025-12-14/lh-explore.json`     |
| `search`      |          92 |  100 |            100 | 100 | 0.8 s | 3.0 s | 170 ms | 0.011 | 1.0 s       | `docs/perf/lighthouse-2025-12-14/lh-search.json`      |
| `post-detail` |          92 |  100 |            100 | 100 | 0.8 s | 3.2 s | 10 ms  | 0.068 | 0.8 s       | `docs/perf/lighthouse-2025-12-14/lh-post-detail.json` |
| `profile`     |         100 |   98 |             96 | 100 | 0.9 s | 1.8 s | 0 ms   | 0     | 0.9 s       | `docs/perf/lighthouse-2025-12-14/lh-profile.json`     |
