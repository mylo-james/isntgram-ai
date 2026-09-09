'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const config = require('./config.cjs');
const preflight = require('./preflight.cjs');
const storage = require('./storage.cjs');
const { createClient } = require('./storage-capabilities.cjs');
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[45][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function binding(c, row, postId) {
  const { post, upload } = row || {};
  if (!post || post.id !== postId || !UUID.test(post.authorId)) throw new Error('Post identity differs');
  if (!upload) {
    if (post.mediaUrl) throw new Error('Unbound media URL');
    return null;
  }
  const prefix = `published/${post.authorId}/`;
  if (upload.postId !== postId || upload.ownerId !== post.authorId || !UUID.test(upload.id) ||
    typeof upload.publishedKey !== 'string' || !upload.publishedKey.startsWith(prefix) ||
    !UUID.test(upload.publishedKey.slice(prefix.length)) ||
    post.mediaUrl !== `${c.storageEndpoint}/${c.bucket}/${upload.publishedKey}` ||
    !/^[a-f0-9]{64}$/.test(upload.publishedChecksum || '') ||
    !Number.isSafeInteger(upload.publishedBytes) || upload.publishedBytes < 1 || upload.publishedBytes > 5242880 ||
    !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(upload.publishedContentType))
    throw new Error('Publication binding differs');
  return upload;
}

async function readPublication(client, bucket, upload, timeoutMs = 5000) {
  const controller = new AbortController();
  let body;
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      body?.destroy?.();
      reject(new Error('Publication read deadline'));
    }, timeoutMs);
  });
  try {
    return await Promise.race([deadline, (async () => {
      const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: upload.publishedKey }),
        { abortSignal: controller.signal });
      body = result.Body;
      if (controller.signal.aborted) { body?.destroy?.(); throw new Error('Read expired'); }
      if (result.ContentLength !== upload.publishedBytes || result.ContentType !== upload.publishedContentType)
        throw new Error('Publication metadata differs');
      const hash = crypto.createHash('sha256');
      let bytes = 0;
      for await (const chunk of body) {
        bytes += chunk.length;
        if (bytes > upload.publishedBytes) throw new Error('Publication body exceeds bound');
        hash.update(chunk);
      }
      const checksum = hash.digest('hex');
      if (bytes !== upload.publishedBytes || checksum !== upload.publishedChecksum)
        throw new Error('Publication bytes differ');
      return { bytes, checksum, contentType: result.ContentType };
    })()]);
  } finally {
    clearTimeout(timer);
    controller.abort();
    body?.destroy?.();
  }
}

async function run(postId) {
  if (!UUID.test(postId || '')) throw new Error('Invalid post ID');
  const c = config.load();
  preflight.capacity();
  const native = preflight.running(c);
  const storageNative = storage.completeQualification(c);
  const id = crypto.randomUUID();
  const evidence = name => config.statePath(path.join(config.STATE, 'evidence', `verify-${id}-${name}.json`));
  const write = (name, value) => fs.writeFileSync(evidence(name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  write('intent', { postId, native, storage: storageNative, commandSha256: config.hashFile(__filename) });
  let client;
  let objectClient;
  try {
    client = await preflight.connect(c, 'app');
    const read = async () => {
      const result = await client.query('SELECT to_jsonb(p) AS post, to_jsonb(u) AS upload FROM posts p LEFT JOIN media_uploads u ON u."postId" = p.id WHERE p.id = $1', [postId]);
      if (result.rowCount !== 1) throw new Error('Post not found or ambiguous');
      return result.rows[0];
    };
    const row = await read();
    const upload = binding(c, row, postId);
    let media = null;
    if (upload) {
      objectClient = createClient(c);
      media = await readPublication(objectClient, c.bucket, upload);
    }
    if (JSON.stringify(await read()) !== JSON.stringify(row)) throw new Error('Post changed during verification');
    write('complete', { postId, authorId: row.post.authorId, content: row.post.content,
      rowSha256: sha(JSON.stringify(row)), media, intent: evidence('intent'),
      uploadId: upload?.id, key: upload?.publishedKey, readonly: true, compilation: false });
    return { receipt: evidence('complete'), postId, mediaVerified: Boolean(media) };
  } catch (error) {
    write('failed', { postId, intent: evidence('intent'), reason: 'verification_refused_or_incomplete' });
    throw error;
  } finally {
    objectClient?.destroy();
    await client?.end();
  }
}
if (require.main === module)
  Promise.resolve().then(() => run(config.args(1)[0])).then(result => console.log(JSON.stringify(result))).catch(() => {
    console.error('Post verification refused; no data was changed. Inspect private evidence.');
    process.exitCode = 1;
  });
module.exports = { run, binding, readPublication };
