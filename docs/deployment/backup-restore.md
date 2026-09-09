# Backup and restore

This runbook applies only to one named Isntgram deployment environment. It is
not a procedure for a local checkout, another preview, or a production cutover.

## Backup contract

Run a backup daily and before an authorized production migration. The job uses
`DATABASE_DIRECT_URL`, never the pooled request URL, and acquires the same
environment-scoped PostgreSQL maintenance lock as migrations and cleanup. It
creates a compressed PostgreSQL `pg_dump -Fc`, then copies only published
objects referenced by that database snapshot into the private backup bucket.
The manifest records environment, source commit, schema migration records,
object key, content type, size, and SHA-256. Write the encrypted manifest and
the completion marker last. A snapshot without that marker is incomplete and
must not be restored.

Keep seven daily encrypted snapshots. The backup credential can write only to
the private backup bucket and is not available to the running web/API service.
Visitor state can remain in inaccessible recovery copies for up to seven days,
even though live visitor state expires after 48 hours.

## Restore contract

Restore only into a newly named isolated database and isolated buckets. Before
any operator proposes production replacement, verify all of the following:

1. The completion marker and manifest hash match.
2. `pg_restore` completes and the recorded migration list matches the restored
   database.
3. Sampled unexpired visitor records and their referenced objects match the
   recorded SHA-256 values.
4. Expired demo users and their media are removed before an application serves
   the restored database.
5. The original database and buckets are unchanged.

Traffic rollback only returns to a compatible prior artifact. It never reverses
database migrations or replaces data. A production data replacement is a
separate, explicitly approved recovery operation.

## Recovery signals

The cleanup workflow records success and failure in
`deployment_maintenance_state`. New demo/upload admission fails closed when
cleanup success is absent or older than three hours in a deployment environment.
Investigate the workflow, pending deletion intents, and bucket credentials, then
run the manually dispatched cleanup. Do not clear the timestamp manually.
