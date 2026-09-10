# Backup and restore

This runbook applies only to one named Isntgram deployment environment. It is not a procedure for a local checkout,
another preview, or a production cutover.

## Backup contract

Run a backup daily and before an authorized production migration. The job uses `DATABASE_DIRECT_URL`, never the pooled
request URL, and acquires the same environment-scoped PostgreSQL maintenance lock as migrations and cleanup. It creates
a compressed PostgreSQL `pg_dump -Fc`, then copies only published objects referenced by that database snapshot into the
private backup bucket. The manifest records environment, source commit, schema migration records, object key, content
type, size, and SHA-256. Write the encrypted manifest and the completion marker last. A snapshot without that marker is
incomplete and must not be restored.

Keep recovery copies for a seven-day age window, including daily, pre-migration and incomplete snapshots. The backup
credential can write only to the private backup bucket and is not available to the running web/API service. Live visitor
state expires after 48 hours. Private recovery copies have a seven-day expiry policy and the restore command rejects
copies at or beyond that age.

## Restore contract

Restore only into a newly named isolated database and isolated buckets. Before any operator proposes production
replacement, verify all of the following:

1. The completion marker and manifest hash match.
2. `pg_restore` completes and the recorded migration list matches the restored database.
3. Sampled unexpired visitor records and their referenced objects match the recorded SHA-256 values.
4. Expired demo users and their media are removed before an application serves the restored database.
5. The original database and buckets are unchanged.

Traffic rollback only returns to a compatible prior artifact. It never reverses database migrations or replaces data. A
production data replacement is a separate, explicitly approved recovery operation.

## Recovery signals

The cleanup workflow records success and failure in `deployment_maintenance_state`. New demo/upload admission fails
closed when cleanup success is absent or older than 27 hours in a deployment environment. Daily cleanup runs at
08:17 UTC; the extra three hours allow scheduling delays or recovery. `CLEANUP_STALE_AFTER_SECONDS` may shorten,
but cannot extend, this cutoff. Investigate the workflow,
pending deletion intents, and bucket credentials, then run the manually dispatched cleanup. Do not clear the timestamp
manually.

## Encryption and native expiry prerequisite

Version 2 encrypts the database, every photo and the manifest with AES-256-GCM. Each payload has a fresh random nonce
and authenticates its exact storage key. The encrypted manifest maps opaque backup object names to original photo keys,
checksums and content types. Only its ciphertext hash is stored in the completion marker. Wrong keys, changed object
locations, corrupt ciphertext and unsupported old plaintext manifests fail restoration.

Before every backup, the script reads the bucket's native lifecycle configuration and requires an enabled seven-day
expiry rule covering all `snapshots/` objects without tags or object-size conditions. Missing policy or read permission
stops before a dump or upload. The application never configures bucket policy; setup is an operator effect. The backup
identity needs scoped lifecycle read permission in addition to its object access. Policy mutation credentials stay
outside runtime.

Prepare this rule on the dedicated backup bucket during approved setup, then read it back through the native S3 API or
Wrangler. It covers partial copies too:

```json
{
  "Rules": [
    {
      "ID": "backup-seven-day-expiry",
      "Status": "Enabled",
      "Filter": { "Prefix": "snapshots/" },
      "Expiration": { "Days": 7 },
      "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 1 }
    }
  ]
}
```

Cloudflare supports the S3 lifecycle read/write operations. Its lifecycle engine usually removes objects within 24 hours
after expiration; expiration is not proof of immediate physical deletion. Verify actual expiry headers, absence of
conflicting bucket locks and object removal during the hosted pilot. If that timing cannot meet the approved retention
limit, resolve the retention plan before enabling the public pilot. Do not describe unobserved deletion as complete. See
[R2 lifecycle behavior](https://developers.cloudflare.com/r2/buckets/object-lifecycles/) and
[S3 API compatibility](https://developers.cloudflare.com/r2/api/s3/api/).
