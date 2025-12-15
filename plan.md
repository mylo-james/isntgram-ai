# Isntgram AI — Interview-Ready Portfolio Plan

Status updated: **Dec 15, 2025**.

Goal: make this repo “recruiter + hiring manager friendly”:

- **5-minute eval path** (demo or local) with no surprises
- **Clean git history** and **clean working tree**
- **Credible senior signals** (tests, CI, security, deployment), without unnecessary complexity

---

## Phase 0 — Make the repo “clean to clone” (non-negotiable)

### Step 0.1 — Ensure the submission is reproducible

- [ ] `git status` is clean on the branch you share (no modified/untracked build artifacts)
- [ ] No secrets committed (double check `.env*`, `firebase-debug.log`, local keys, etc.)
- [ ] `pnpm install --frozen-lockfile` works on a fresh clone
- [ ] Add toolchain hints:
  - [ ] `.nvmrc` (Node 20) and/or `.tool-versions` (asdf) to match CI

### Step 0.2 — Make quality gates deterministic

- [ ] Fix Markdown lint failures and ensure `pnpm run lint:all` passes
- [ ] Ensure all important docs are tracked in git (deployment docs, ADRs, evaluator guide)
- [ ] Remove stale references (e.g. missing docs referenced by README/plan)

---

## Phase 1 — “Recruiter surface area” (README + demo path)

### Step 1.1 — Rewrite README for scanability (30–60 seconds)

- [ ] Add **live demo link** (if you keep it online) and clearly label demo limitations
- [ ] Add a short “What this demonstrates” section (CI, E2E, Docker, Auth boundary, AI integration)
- [ ] Add a 5-minute “Evaluator path” (link to `docs/evaluator-guide.md`)
- [ ] Add “Run locally” with copy/paste commands and expected URLs
- [ ] Add a “Tradeoffs / what I’d do next” section (shows senior judgment)

### Step 1.2 — Portfolio artifacts

- [ ] Ensure `pnpm run portfolio:artifacts` reliably generates:
  - [ ] demo video (`docs/assets/demo.webm`)
  - [ ] screenshots (`docs/assets/`)
  - [ ] lighthouse baseline (`docs/perf/…`)
- [ ] Decide what gets committed vs generated (be explicit in README)

### Step 1.3 — Optional: live demo stability checklist

- [ ] `/health` and `/api/health` are stable and fast
- [ ] Demo sign-in always works
- [ ] AI feature is either:
  - [ ] reliably enabled (with spend guardrails), or
  - [ ] clearly labeled as optional/offline (no broken buttons)

---

## Phase 2 — Remove the main “code smells” (high leverage)

### Step 2.1 — Simplify auth/state (pick one direction)

#### Option A (recommended): remove Redux auth mirror

- [ ] Use NextAuth as the single source of truth (`auth()` server-side + `useSession()` client-side)
- [ ] Keep Redux only for non-auth UI state (or remove Redux entirely if it’s not pulling its weight)
- [ ] Ensure UI doesn’t fabricate profile counts/fields on login (avoid misleading state)

#### Option B: keep Redux, but make it strictly derived

- [ ] Document why Redux exists
- [ ] Remove placeholder fields and fetch real data (or don’t store it at all)
- [ ] Make demo detection come from API/session claims, not heuristics

### Step 2.2 — Fix contract/correctness gaps that reviewers will notice

- [ ] Followers/following endpoints: return accurate `isFollowing` relative to the viewer (or remove the field)
- [ ] Search results: set `likedByMe` when authenticated (or clearly document “search is anonymous”)
- [ ] Add/extend tests for these behaviors (unit or integration)

### Step 2.3 — Resolve `shared-types` drift (avoid “why is this here?”)

Pick one:

- [ ] **Remove** `packages/shared-types` if it’s unused (simpler, less confusion), or
- [ ] **Make it real**:
  - [ ] Align types to actual API DTOs
  - [ ] Use it in both web + api (or generate types from OpenAPI and consume in web)

---

## Phase 3 — Tighten security + ops defaults (show CTO instincts)

- [ ] Re-evaluate DB SSL defaults (avoid `rejectUnauthorized: false` as a silent production default)
- [ ] Ensure error responses are consistent and UI-safe (e.g. validation errors aren’t arrays in `message`)
- [ ] Confirm demo mode is enforced server-side for all mutations (posts/likes/comments/follows/profile)
- [ ] Confirm rate limiting coverage matches intent (global vs per-route)

---

## Phase 4 — “Interview kit” (help yourself win the room)

- [ ] Add `docs/interview/` with:
  - [ ] **Architecture overview** (1 page: web ↔ api ↔ db, auth flow, deploy flow)
  - [ ] **Key tradeoffs** (why NextAuth, why Nest, why standalone, why denormalized counters)
  - [ ] **Scaling plan** (feed ranking, caching, DB indexes, background jobs)
  - [ ] **Security threats considered** (IDOR/CSRF/XSS/rate limiting/secrets)
- [ ] Add a 5-minute demo script you can follow under stress

---

## Final quality gates (run before sharing)

```bash
pnpm run lint:all
pnpm run type-check
pnpm test --watchAll=false
pnpm run build:all
pnpm run test:e2e
```

---

## Suggested order of execution (fastest ROI)

1. Phase 0 (clean + reproducible)
2. Phase 1 (README + evaluator path)
3. Phase 2.1 (auth/state simplification)
4. Phase 2.2 (correctness gaps)
5. Phase 2.3 (shared-types decision)
6. Phase 4 (interview kit)
7. Phase 3 (security/ops defaults)
8. Final quality gates + publish
