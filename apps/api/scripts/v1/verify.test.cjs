'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { binding, readPublication, run } = require('./verify.cjs');
const config = require('./config.cjs');
const preflight = require('./preflight.cjs');
const fixture = require('./fixture.cjs');
const postId = '599a9a92-dd88-53f9-a07b-3e454286b373';
const ownerId = '3803f946-9325-5852-804d-fbb8d8f874fe';
const uploadId = '8e74403c-4626-586b-93a0-31c04548f4c7';
const body = Buffer.from('bounded bytes');
const upload = { id: uploadId, ownerId, postId, publishedKey: `published/${ownerId}/${postId}`,
  publishedBytes: body.length, publishedContentType: 'image/jpeg',
  publishedChecksum: crypto.createHash('sha256').update(body).digest('hex') };
const c = { storageEndpoint: 'http://127.0.0.1:48333', bucket: 'isntgram-v1-media' };
const post = { id: postId, authorId: ownerId, mediaUrl: `${c.storageEndpoint}/${c.bucket}/${upload.publishedKey}` };

test('independent verification requires owned immutable media binding, or a text post', () => {
  assert.equal(binding(c, { post, upload }, postId), upload);
  assert.equal(binding(c, { post: { ...post, mediaUrl: null }, upload: null }, postId), null);
  assert.throws(() => binding(c, { post, upload: null }, postId), /Unbound/);
  for (const changes of [{ ownerId: postId }, { postId: ownerId }, { publishedBytes: 5242881 },
    { publishedChecksum: 'bad' }, { publishedContentType: 'text/html' }, { publishedKey: 'pending/example' }])
    assert.throws(() => binding(c, { post, upload: { ...upload, ...changes } }, postId), /binding differs/);
});

test('object proof consumes actual bytes and rejects false metadata or checksum', async () => {
  const response = bytes => ({ ContentLength: body.length, ContentType: 'image/jpeg', Body: Readable.from([bytes]) });
  const good = await readPublication({ send: async () => response(body) }, c.bucket, upload);
  assert.equal(good.checksum, upload.publishedChecksum);
  await assert.rejects(readPublication({ send: async () => response(Buffer.alloc(body.length)) }, c.bucket, upload), /bytes differ/);
  await assert.rejects(readPublication({ send: async () => response(Buffer.alloc(body.length + 1)) }, c.bucket, upload), /exceeds bound/);
  await assert.rejects(readPublication({ send: async () => ({ ...response(body), ContentType: 'text/html' }) }, c.bucket, upload), /metadata differs/);
});

test('whole read deadline covers stalled headers and stalled body', async () => {
  await assert.rejects(readPublication({ send: () => new Promise(() => {}) }, c.bucket, upload, 10), /deadline/);
  const stream = new Readable({ read() {} });
  await assert.rejects(readPublication({ send: async () => ({ ContentLength: body.length, ContentType: 'image/jpeg', Body: stream }) }, c.bucket, upload, 10), /deadline/);
  assert.equal(stream.destroyed, true);
});

test('compile-capable fixture verification refuses an occupied API before compiling', async t => {
  t.mock.method(config, 'load', () => ({}));
  t.mock.method(preflight, 'freePorts', ports => {
    assert.deepEqual(ports, [4321, 4322]);
    throw new Error('API occupied');
  });
  await assert.rejects(fixture.run('verify'), /API occupied/);
  await assert.rejects(run('invalid'), /Invalid post ID/);
});

test('a listener-free Node watcher still prevents competing API compilation', () => {
  assert.throws(() => preflight.noApiBuildProcesses(() => `p123\nn${config.FIXED.root}/apps/api\n`), /build\/watch process is active/);
  assert.doesNotThrow(() => preflight.noApiBuildProcesses(() => 'p123\nn/another/project\n'));
  assert.throws(() => preflight.noApiBuildProcesses(() => { throw new Error('denied'); }), /inspection unavailable/);
});
