# 5-Minute Demo Script

Goal: show a complete product path and the engineering signals behind it.

## 1) Start at login

- Go to `/login`
- Click **Try our demo**
- Point out the **demo banner** and that demo is **read-only server-side**

## 2) Feed

- Open `/feed`
- Open an existing post
- Mention AI captions (if enabled) and that the API key is server-side only

## 3) Post detail

- Open `/posts/[id]`
- If using a real account (not demo), add a comment and like/unlike

## 4) Explore + search

- Open `/explore`
- Search for a username or a hashtag via `/search`
- Click a hashtag inside a post to show deep-linking

## 5) Profile + follows

- Open your profile via the header (or `/[username]`)
- Follow/unfollow another user (real account), then show follower/following modals

## 6) Close with engineering signals

- Tests: `pnpm test` + `pnpm run test:e2e`
- CI/security: point to `.github/workflows/ci.yml`
- Deployment artifacts: `apps/*/Dockerfile.prod`, `docker-compose.prod.yml`, `docs/deployment/*`
