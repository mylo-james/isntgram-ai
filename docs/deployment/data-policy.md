# Isntgram deployment data policy

The public preview and production profiles are demo-only. A visitor receives a
temporary account whose session expires 48 hours after creation. Daily cleanup
removes expired accounts, posts and uploaded media. Under normal operation,
deletion occurs within the following 24 hours, about 72 hours after session
creation at most. Published photos can remain publicly accessible until deletion;
a delayed or failed cleanup run can extend that interval.

Cleanup runs daily at 08:17 UTC. New demo sessions and uploads stop when cleanup
has not reported a successful run within 27 hours. This allows three hours for
scheduling delays or recovery while keeping the existing storage and admission
limits. `CLEANUP_STALE_AFTER_SECONDS` can tighten that cutoff, but cannot raise it
above 97,200 seconds. Ordinary registration remains
available in normal local application mode and is rejected only when
`DEPLOYMENT_ENV` is explicitly `preview` or `production`.

The fictional community is seeded application content. Its metadata and the
committed community images are shared, reproducible assets: the application
does not copy them per visitor. Visitor-created records and validated published
uploads are temporary deployment data. Pending upload objects have short
reservations and are reconciled by cleanup; unvalidated bytes are never served
from the public media store.

Recovery copies, when enabled separately, are private and governed by the backup
runbook's up-to-seven-day retention policy. The cleanup schedule does not enable
backups. A restore is performed only into an isolated target and does not make
expired visitor data live again.
