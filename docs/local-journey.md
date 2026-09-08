# Legacy local journey

For the current local demonstration, use [the v1 runbook](v1-local.md) and [demo playbooks](demo-playbooks.md). This
earlier journey harness remains available for its focused regression checks.

The `journey:*` commands resolve state relative to the invoking checkout under `.local/journey/`. They use a separate
PostgreSQL target on `127.0.0.1:55431`; the v1 harness uses port 55432. Do not copy private configuration between them.

Use the Node version in `.nvmrc` and pnpm 9.12.3. From the repository root, `pnpm test:journey:guards` runs the isolated
guard tests. Read-only commands `pnpm journey:config -- show` and `pnpm journey:preflight -- stopped` inspect an already
configured legacy target. They do not establish a running service or initialize a missing cluster.

Private configuration, process identities, logs, database files and test receipts belong under `.local/` and must stay
out of Git. Runtime actions require a qualified target and its matching native process identity. An occupied port never
identifies a process that can safely be stopped. Diagnose configuration conflicts without deleting retained state.
