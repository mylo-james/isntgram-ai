#!/usr/bin/env bash
set -euo pipefail

# Disposable test storage. Supply an installed SeaweedFS 4.45 binary.
storage_dir=$(mktemp -d "${TMPDIR:-/tmp}/isntgram-e2e-storage.XXXXXX")
mkdir -p "$storage_dir/data" "$storage_dir/config" "$storage_dir/logs"
cat > "$storage_dir/identities.json" <<'JSON'
{"identities":[{"name":"e2e","credentials":[{"accessKey":"e2e-access","secretKey":"e2e-secret-for-disposable-tests"}],"actions":["Admin","Read","Write","List","Tagging"]}]}
JSON

exec "${E2E_WEED_BIN:-weed}" -config_dir="$storage_dir/config" -logdir="$storage_dir/logs" server \
  -ip=127.0.0.1 -ip.bind=127.0.0.1 -dir="$storage_dir/data" -master.dir="$storage_dir/data" \
  -master=true -volume=true -filer=true -s3=true \
  -master.port=29333 -volume.port=28080 -filer.port=28888 -s3.port=9000 \
  -s3.ip.bind=127.0.0.1 -master.volumeSizeLimitMB=64 -volume.fileSizeLimitMB=5 \
  -webdav=false -sftp=false -iam=false -s3.iam=false -mq.broker=false -mq.agent=false \
  -debug=false -metricsPort=0 -master.telemetry=false -s3.port.iceberg=0 -s3.port.lance=0 \
  -s3.autoCreateBucket=false -s3.config="$storage_dir/identities.json" \
  -s3.allowedOrigins="${E2E_WEB_URL:-http://127.0.0.1:3100}" \
  -filer.allowedOrigins="${E2E_WEB_URL:-http://127.0.0.1:3100}" \
  -s3.concurrentFileUploadLimit=1 -s3.concurrentUploadLimitMB=5 \
  -filer.concurrentFileUploadLimit=1 -filer.concurrentUploadLimitMB=5 \
  -filer.localSocket="$storage_dir/filer.sock" -s3.localSocket="$storage_dir/s3.sock"
