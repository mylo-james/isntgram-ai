# Isntgram deployment data policy

The public preview and production profiles are demo-only. A visitor receives a
temporary account, posts, and uploaded media that expire 48 hours after the
session is created. New demo sessions and uploads stop when cleanup has not
reported a successful run within three hours. Ordinary registration remains
available in normal local application mode and is rejected only when
`DEPLOYMENT_ENV` is explicitly `preview` or `production`.

The fictional community is seeded application content. Its metadata and the
committed community images are shared, reproducible assets: the application
does not copy them per visitor. Visitor-created records and validated published
uploads are temporary deployment data. Pending upload objects have short
reservations and are reconciled by cleanup; unvalidated bytes are never served
from the public media store.

Recovery copies are private and governed by the backup runbook. The visitor
notice distinguishes the 48-hour live lifetime from the separately documented
up-to-seven-day recovery-copy retention. A restore is performed only into an
isolated target and does not make expired visitor data live again.
