# Isntgram v1 local operator guide

This guide describes portable local operation of the v1 application commands. It does not establish that any service is
running, that a fixture has a particular state, or that a prior local run remains current.

## Safety boundary

Run commands from the application checkout. Commands that change state are called out explicitly. Read configuration
through the supplied commands only; do not print, copy, source, or edit private configuration values.

Use the guarded `v1:*` commands rather than legacy `dev:*` commands. Do not use unguarded migration, reset, cleanup,
kill-by-port, or broad process commands. An occupied or unexpected listener is a reason to stop and investigate, not
permission to terminate a process.

Run each foreground process in its own terminal. An API or web watcher and a separate build must not write the same
generated-output tree concurrently. Retain data, fixture rows, objects, and diagnostic material after a failure; this v1
flow has no cleanup command.

## Guarded commands

```sh
# Read-only identity and runtime checks. Config show redacts secrets.
pnpm run v1:config -- show
pnpm run v1:preflight -- stopped
pnpm run v1:storage -- inspect

# State-changing database lifecycle. Use only when the stopped preflight passed.
pnpm run v1:db -- start
pnpm run v1:preflight -- running

# Explicit migrations target guarded databases. They are not a reset.
pnpm run v1:migrate -- app
pnpm run v1:migrate -- test

# Read-only retained-fixture check.
pnpm run v1:fixture:verify
```

`pnpm run v1:fixture` is an idempotent write. Run it only after the guarded preflight has established that the required
application listeners are free. It must refuse conflicts and preserve existing rows and objects. Do not run it merely to
make a demonstration look fresh.

```sh
# State-changing fixture apply. Use only with API stopped and after guard checks.
pnpm run v1:fixture

# Read-only verification of one existing post and, when present, bound media.
pnpm run v1:verify -- POST_UUID
```

Retained-socket inspection requires the private before-stop receipt and its reviewed SHA-256. A receipt from another
process, inode or checkout path does not qualify. Keep a refused socket intact until the exact recovery decision is
resolved.

Storage startup is a foreground, stateful action. Inspect storage first, retain its diagnostics, and do not daemonize it
or run a second storage process.

```sh
# Read-only readiness and retained-socket checks.
pnpm run v1:storage:readiness -- STORAGE_LAUNCH_RECEIPT
pnpm run v1:storage:retained-sockets -- inspect BEFORE_STOP_RECEIPT REVIEWED_SHA256

# State-changing foreground storage launch, after qualification.
pnpm run v1:storage:start
```

After the running preflight, storage qualification, and fixture verification succeed, start application processes in
separate foreground terminals:

```sh
# Stateful API launch.
node apps/api/scripts/v1/app.cjs api

# Stateful web launch. It requires API semantic readiness.
node apps/api/scripts/v1/app.cjs web
```

No launcher should automatically start a database, storage process, browser, or another watcher. A command returning
does not prove its process remains running.

## Check, recover, and stop

Use a fresh identity check before every consequential action:

```sh
pnpm run v1:preflight -- running
pnpm run v1:storage -- inspect
```

For a supervised recovery, stop only the verified foreground application sessions with `Ctrl-C`. Use the guarded
database command only for the owned, identified cluster, then re-establish preflight and semantic readiness before a
visible retry. Do not repeat an outage automatically.

```sh
pnpm run v1:db -- stop
pnpm run v1:preflight -- stopped
pnpm run v1:db -- start
pnpm run v1:preflight -- running
```

## Private phone demonstration boundary

A private phone demonstration must preserve private pending objects, restrict published media to its configured origin
policy, and avoid public deployment or changes to unrelated local routes. Inspect the current application state with the
reviewed source-owned commands before any state-changing action. A desktop browser check is not equivalent to an
observed physical-phone interaction.

## Focused verification and partial runs

Use substantive commands: `lint:web`, `lint:api`, `lint:shared-types`, `lint:journey`, `lint:v1`, `lint:md`,
`type-check`, `build:shared-types`, `build:api` and `build:web`. The root `lint` and `build` currently do no work.
`contracts:check` builds the shared workspace dependency, then generates temporary copies and compares their bytes with
the current working contract files. It leaves those files untouched, including when generation fails or contracts are
stale. Uncommitted contracts pass when they match the current API source. `contracts:generate` updates both files only
after generation succeeds and preserves existing bytes under `.local/contract-backups/` before writing. Review the
resulting diff. These checks do not recover earlier versions that were overwritten without a backup.

The focused legacy accessibility configuration uses ports 3100 and 4011 with fresh in-memory SQLite. It requires its own
production web build for those origins and synthetic auth values. Stop conflicting watchers first. Its one ordinary
account and text post belong only to that ephemeral process. Do not reuse the legacy build as proof of v1 authentication
or PostgreSQL persistence.

```sh
node node_modules/@playwright/test/cli.js test e2e/a11y.test.ts \
  --config playwright.a11y.config.ts --workers 1 --retries 0
```

After v1 services and the selected browser origin are qualified, use exact case selection. These commands create
retained application records:

```sh
node node_modules/@playwright/test/cli.js test --config playwright.v1.config.ts \
  --grep 'PB-01 keyboard publication at 1280px persists across sessions'
node node_modules/@playwright/test/cli.js test --config playwright.v1.config.ts \
  --grep 'PB-01 keyboard publication at 390px persists across sessions'
node node_modules/@playwright/test/cli.js test --config playwright.v1.config.ts \
  --grep 'TA07 notification-pagination preserves the first page'
node node_modules/@playwright/test/cli.js test --config playwright.v1.config.ts \
  --grep 'TA08 upload-timeout retains the original photo attempt'
node node_modules/@playwright/test/cli.js test --config playwright.v1.config.ts \
  --grep 'TA08 uncertain-publication retains the original photo attempt'
```

Do not run the entire browser file to repeat one failed case. Inspect its private start/progress/partial receipt and
actual rows and objects first. A new UUID creates new retained effects. A partial run must resume only its remaining
verified actions or receive a revised effect allowance. Honor authentication throttles; never disable them or blindly
retry a write.

A notification run that completed all fixture writes can continue without creating another fixture. Supply its private
partial receipt explicitly:

```sh
TA07_NOTIFICATION_RESUME_RECEIPT=/absolute/private/v1-e2e-ta07-notification-pagination-partial-UUID.json \
  node node_modules/@playwright/test/cli.js test --config playwright.v1.config.ts \
  --grep 'TA07 notification-pagination preserves the first page'
```

This mode validates the receipt, runtime/corpus identity, current row hashes and exact actor/post/comment/notification
relationships before login. It reserves zero rows and skips registration, post creation and comment creation. It refuses
an incomplete fixture or any changed application snapshot. It still exercises the real first page, one injected cursor
failure, the real retry and post link.

The API launcher records a unique private log path in its launch receipt and redirects both output streams there. Before
the single recovery exercise, bind that receipt to the live launcher and listener, then record the log offset. Give the
browser's feed document navigation one fresh UUID in `x-request-id`; require one matching safe API failure record for
`GET /api/posts/feed`, status 500. After restoring the same cluster, select the visible `Retry feed` link once.

## Coverage gate

Jest and the standalone coverage reporter share overall minimums of 85% statements, 79% branches, 87% functions and 87%
lines. The reporter calculates weighted totals across the full runtime inventory; `coverage:changed` applies those same
minimums to the selected changed-source inventory. Individual files can fall below these overall minimums. Missing
coverage entries, missing inventory paths and unclassified runtime additions still fail validation. Lowering these
minimums does not increase measured coverage.
