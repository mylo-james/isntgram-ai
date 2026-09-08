'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const config = require('./config.cjs');
const preflight = require('./preflight.cjs');
const phone = require('./phone-view.cjs');
const storage = require('./storage.cjs');
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
async function boundedBytes(response, expected) {
  assert.ok(Number.isSafeInteger(expected) && expected > 0 && expected <= 5242880);
  assert.equal(Number(response.headers.get('content-length')), expected);
  const chunks = [];
  let bytes = 0;
  try {
    for await (const chunk of response.body) {
      bytes += chunk.length;
      assert.ok(bytes <= expected);
      chunks.push(chunk);
    }
    assert.equal(bytes, expected);
    return Buffer.concat(chunks);
  } finally {
    if (!response.body?.locked) await response.body?.cancel().catch(() => undefined);
  }
}
async function run(startId) {
  assert.match(startId || '', UUID);
  const c = config.load();
  const evidence = config.statePath(path.join(config.STATE, 'evidence', `phone-readonly-proof-${crypto.randomUUID()}.json`));
  const result = { at: new Date().toISOString(), startId,
    configSha256: config.hashFile(config.FILE), sourceSha256: config.hashFile(__filename), steps: [] };
  const persist = stage => fs.writeFileSync(evidence, JSON.stringify({ ...result, stage }, null, 2) + '\n', { mode: 0o600 });
  fs.writeFileSync(evidence, '{}\n', { flag: 'wx', mode: 0o600 });
  persist('started');
  let client;
  let database;
  try {
    result.checkpoint = 'native-database'; persist('checking');
    assert.ok(c.phoneView);
    result.native = preflight.running(c);
    result.checkpoint = 'native-storage'; persist('checking');
    result.storageNative = storage.completeQualification(c);
    result.checkpoint = 'native-serve'; persist('checking');
    const startFile = config.statePath(path.join(config.STATE, 'evidence', `phone-start-${startId}.json`));
    config.privateFile(startFile);
    const start = JSON.parse(fs.readFileSync(startFile, 'utf8'));
    const status = JSON.parse(config.native('/usr/local/bin/tailscale', ['status', '--json'], { timeout: 15000 }));
    assert.deepEqual(phone.routes(c, status), start.routes);
    assert.equal(config.hashFile(fs.realpathSync('/usr/local/bin/tailscale')), start.executableSha256);
    const serve = () => JSON.parse(config.native('/usr/local/bin/tailscale', ['serve', 'status', '--json'], { timeout: 15000 }));
    phone.assertState(serve(), start.baseline, start.routes);
    result.checkpoint = 'fixture-read'; persist('checking');
    database = await preflight.connect(c, 'app');
    const corpus = JSON.parse(fs.readFileSync(path.join(config.ROOT, 'fixtures/v1/content.json'), 'utf8'));
    const rows = await database.query('SELECT u."pendingKey", u."expectedBytes", u."publishedKey", u."publishedBytes", u."publishedChecksum" FROM media_uploads u WHERE u."postId" = $1', [corpus.photos[0].postId]);
    assert.equal(rows.rowCount, 1);
    const row = rows.rows[0];
    assert.match(row.pendingKey, /^pending\/[a-f0-9-]{36}\/[a-f0-9-]{36}$/);
    assert.match(row.publishedKey, /^published\/[a-f0-9-]{36}\/[a-f0-9-]{36}$/);
    const pendingUrl = `${c.phoneView.s3Origin}/${c.bucket}/${row.pendingKey}`;
    const request = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(5000), redirect: 'error' });
    result.checkpoint = 'anonymous-pending'; persist('checking');
    const anonymous = await request(pendingUrl, { method: 'HEAD' });
    assert.equal(anonymous.status, 403);
    result.steps.push({ check: 'pending-anonymous-head', status: anonymous.status }); persist('probing');
    client = new S3Client({ endpoint: c.phoneView.s3Origin, region: 'us-east-1', forcePathStyle: true, maxAttempts: 1,
      credentials: { accessKeyId: c.secrets.S3_ACCESS_KEY_ID, secretAccessKey: c.secrets.S3_SECRET_ACCESS_KEY } });
    const signed = await getSignedUrl(client, new HeadObjectCommand({ Bucket: c.bucket, Key: row.pendingKey }), { expiresIn: 60 });
    assert.equal(new URL(signed).origin, c.phoneView.s3Origin);
    result.checkpoint = 'signed-pending'; persist('checking');
    const valid = await request(signed, { method: 'HEAD' });
    assert.equal(valid.status, 200);
    assert.equal(Number(valid.headers.get('content-length')), Number(row.expectedBytes));
    const invalid = new URL(signed);
    assert.ok(invalid.searchParams.has('X-Amz-Signature'));
    invalid.searchParams.set('X-Amz-Signature', '0'.repeat(64));
    const rejected = await request(invalid.href, { method: 'HEAD' });
    assert.equal(rejected.status, 403);
    result.steps.push({ check: 'external-signed-private-head', validStatus: 200, invalidSignatureStatus: 403 }); persist('probing');
    for (const [label, origin, expected] of [['phone', c.phoneView.webOrigin, 200], ['local', c.webOrigin, 200], ['foreign', 'https://foreign.invalid', 403]]) {
      result.checkpoint = `cors-${label}`; persist('checking');
      const response = await request(pendingUrl, { method: 'OPTIONS', headers: { Origin: origin,
        'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'content-type' } });
      assert.equal(response.status, expected);
      assert.equal(response.headers.get('access-control-allow-origin'), expected === 200 ? origin : null);
      await response.body?.cancel();
      result.steps.push({ check: `cors-${label}`, status: response.status, correctAllowOrigin: true }); persist('probing');
    }
    result.checkpoint = 'published-bytes'; persist('checking');
    const published = await request(`${c.phoneView.s3Origin}/${c.bucket}/${row.publishedKey}`);
    assert.equal(published.status, 200);
    const bytes = await boundedBytes(published, Number(row.publishedBytes));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), row.publishedChecksum);
    result.steps.push({ check: 'published-anonymous-get', status: 200, bytes: bytes.length, sha256: row.publishedChecksum });
    const after = await database.query('SELECT u."pendingKey", u."expectedBytes", u."publishedKey", u."publishedBytes", u."publishedChecksum" FROM media_uploads u WHERE u."postId" = $1', [corpus.photos[0].postId]);
    assert.deepEqual(after.rows, rows.rows);
    phone.assertState(serve(), start.baseline, start.routes);
    persist('passed');
    return { receipt: evidence, passed: true, readOnly: true };
  } catch (error) {
    result.failure = { name: ['Error', 'TypeError', 'TimeoutError', 'AssertionError'].includes(error?.name) ? error.name : 'Error',
      ...(Number.isInteger(error?.actual) && Number.isInteger(error?.expected) ? { actual: error.actual, expected: error.expected } : {}) };
    persist('failed');
    throw new Error('Read-only phone proof failed; inspect private evidence. No retry or data writes occurred.');
  } finally {
    client?.destroy();
    await database?.end();
  }
}
if (require.main === module) Promise.resolve().then(() => run(config.args(1)[0])).then(result => console.log(JSON.stringify(result))).catch(() => {
  console.error('Read-only phone proof refused. Inspect private evidence; no automatic retry.');
  process.exitCode = 1;
});
module.exports = { boundedBytes, run };
