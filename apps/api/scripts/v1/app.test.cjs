'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const config = require('./config.cjs');
const { environment, start } = require('./app.cjs');
const c = {
  ...config.FIXED,
  demoReady: true,
  secrets: Object.fromEntries(
    config.SECRET_KEYS.map((key) => [key, 'private-test-value']),
  ),
};

test('web receives session configuration but no database, signing or storage credentials', () => {
  const env = environment(c, 'web', 310);
  assert.equal(env.NODE_ENV, 'development');
  assert.equal(env.NEXTAUTH_SECRET, 'private-test-value');
  assert.equal(env.INTERNAL_API_URL, 'http://127.0.0.1:4321');
  assert.equal(env.NEXT_PUBLIC_DEMO_ENABLED, 'true');
  assert.equal(env.ISNTGRAM_LOCAL_MEDIA, 'true');
  for (const key of Object.keys(env)) {
    assert.ok(!/^(DATABASE_|JWT_|S3_|ISNTGRAM_V1_)/.test(key), key);
    if (key.startsWith('NEXT_PUBLIC_'))
      assert.notEqual(env[key], 'private-test-value', key);
  }
});

test('API retains production safety and subtracts retained test rows from demo capacity', () => {
  const env = environment(c, 'api', 310);
  assert.equal(env.NODE_ENV, 'production');
  assert.equal(env.DEMO_RECORD_LIMIT, '690');
  assert.equal(env.DEMO_CONTENT_SOURCE, 'curated');
  assert.equal(env.AI_PROVIDER, undefined);
  assert.equal(env.METRICS_ENABLED, 'false');
  assert.equal(env.AUTH_SECRET, undefined);
  assert.equal(env.NEXTAUTH_SECRET, undefined);
  assert.equal(env.OPENAI_API_KEY, undefined);
  assert.equal(env.ISNTGRAM_LOCAL_MEDIA, undefined);
  assert.equal(env.DATABASE_SSL, 'false');
  assert.equal(env.DEMO_ENABLED, 'true');
  assert.equal(Object.hasOwn(env, 'S3_PRESIGN_ENDPOINT'), false);
  assert.equal(Object.hasOwn(env, 'S3_DISPLAY_BASE_URL'), false);
  assert.ok(Object.values(env).every((value) => typeof value === 'string'));
  assert.equal(
    environment({ ...c, demoReady: false }, 'api', 310).DEMO_ENABLED,
    'false',
  );
});

test('phone view reaches only the named API and web environment fields', () => {
  const phoneView = {
    webOrigin: 'https://isntgram-phone.example.ts.net:8445',
    s3Origin: 'https://isntgram-phone.example.ts.net:8446',
    serveWebPort: 8445,
    serveS3Port: 8446,
  };
  const api = environment({ ...c, phoneView }, 'api', 310);
  assert.equal(api.S3_ENDPOINT, c.storageEndpoint);
  assert.equal(api.S3_PUBLIC_BASE_URL, `${c.storageEndpoint}/${c.bucket}`);
  assert.equal(api.S3_PRESIGN_ENDPOINT, phoneView.s3Origin);
  assert.equal(api.S3_DISPLAY_BASE_URL, `${phoneView.s3Origin}/${c.bucket}`);
  const web = environment({ ...c, phoneView }, 'web', 310);
  assert.equal(web.NEXTAUTH_URL, phoneView.webOrigin);
  assert.equal(web.NEXT_PUBLIC_APP_URL, phoneView.webOrigin);
  assert.equal(
    web.NEXT_PUBLIC_MEDIA_HOSTS,
    '127.0.0.1:48333,isntgram-phone.example.ts.net:8446',
  );
  for (const key of Object.keys(web))
    assert.equal(key.startsWith('S3_'), false, key);
});

test('invalid retained counts and service selectors are refused before launch', async () => {
  for (const count of [-1, 0.5, 1000, NaN, '310'])
    assert.throws(() => environment(c, 'api', count), /Invalid retained/);
  assert.throws(() => environment(c, 'worker', 0), /Unknown application/);
  await assert.rejects(start('worker'), /Use api or web/);
});
