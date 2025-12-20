# Web (Next.js)

This app lives in the monorepo. See the root `README.md` for full setup.

## Local dev (from repo root)

```bash
pnpm --filter web dev
```

The web app expects the API at `INTERNAL_API_URL` / `NEXT_PUBLIC_API_URL`.

Optional: set `NEXT_PUBLIC_DEMO_ENABLED=true` to show the demo sign-in button.
