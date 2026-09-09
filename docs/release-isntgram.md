# Isntgram release runbook

The deployment workflow is disabled until `ISNTGRAM_DEPLOYMENT_ENABLED=true` is set in the selected protected
environment. It accepts only an exact 40-character candidate source SHA. Stage builds API and web together; production
runs the encrypted backup then migration before API stage, followed by web stage. A promotion input is only a numeric
Actions stage-run identifier. The promotion job must recheck its immutable run provenance, source/config/artifact
identity, migration records, project IDs, and canonical aliases before API then web promotion. No untrusted deployment
ID is accepted directly.

After API promotion and canonical health pass, the release updates the protected GitHub environment variable
`ISNTGRAM_DEPLOYED_RECORD` in one write and reads it back. Its shape is
`{"version":1,"sourceSha":"<full Git SHA>","configRevision":"<revision>"}`. Cleanup and backup select both values from
that single record. Bootstrap creates the variable before release automation is enabled. `MAINTENANCE_RECORD_TOKEN`
requires repository environment-variable write access, is available only to the release environment, and is never given
to the app. If recording fails after API promotion, the job fails and web promotion stops; inspect the canonical API and
repair the record before the next maintenance run. Do not treat the pair as an atomic API/web release.

Set `PG_CLIENT_MAJOR` to the selected database major (16, 17 or 18), and ensure that major's native client exists on the
runner. An unavailable client fails the job before maintenance. The migration, cleanup and backup roles use separate
`MIGRATION_DATABASE_DIRECT_URL`, `CLEANUP_DATABASE_DIRECT_URL` and `BACKUP_DATABASE_DIRECT_URL` secrets. Runtime uses
its own pooled request role. The backup script receives the accepted API source and `DEPLOYED_API_CONFIG_REVISION`;
maintenance tool provenance is recorded separately.

Each deployment environment has a provisioned `deployment_target` row with a unique UUID, environment name and exact
pending/published/backup bucket names. Set `DEPLOYMENT_TARGET_ID` to that UUID. Only the initial explicit migration can
use `ALLOW_DEPLOYMENT_BOOTSTRAP=true` when this table is absent. Populate and verify the target row before any cleanup,
backup or subsequent migration. A restored database remains quarantined until its target row is explicitly rebound to
the new environment and new bucket identities.

First deployment needs a separately reviewed bootstrap because ordinary releases require an existing canonical alias and
record its deployment ID before staging. Receipts bind real project settings and target-scoped environment metadata;
secrets are excluded. Native Vercel first-deployment, staging and promotion semantics remain hosted qualification work.
