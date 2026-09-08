'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { ROOT } = require('./config.cjs');
const { blockCrossSiteDEV } = require(path.join(ROOT, 'apps/web/node_modules/next/dist/server/lib/router-utils/block-cross-site-dev.js'));
async function load(values) {
  const keys = ['NODE_ENV', 'ISNTGRAM_LOCAL_MEDIA', 'NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_MEDIA_HOSTS'];
  const old = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    for (const key of keys) {
      if (values[key] === undefined) delete process.env[key]; else process.env[key] = values[key];
    }
    return (await import(`${pathToFileURL(path.join(ROOT, 'apps/web/next.config.mjs')).href}?test=${randomUUID()}`)).default;
  } finally {
    for (const key of keys) {
      if (old[key] === undefined) delete process.env[key]; else process.env[key] = old[key];
    }
  }
}
const phone = { NODE_ENV: 'development', ISNTGRAM_LOCAL_MEDIA: 'true', NEXT_PUBLIC_APP_URL: 'https://example.ts.net:8445', NEXT_PUBLIC_MEDIA_HOSTS: '127.0.0.1:48333,example.ts.net:8446' };

test('phone view permits exact native dev hostname while production and ordinary local behavior remain unchanged', async () => {
  const config = await load(phone);
  assert.deepEqual(config.allowedDevOrigins, ['example.ts.net']);
  assert.equal(config.images.unoptimized, true);
  assert.deepEqual(config.images.remotePatterns[1], { protocol: 'https', hostname: 'example.ts.net', port: '8446', pathname: '/**' });
  const production = await load({ ...phone, NODE_ENV: 'production' });
  assert.equal(production.allowedDevOrigins, undefined);
  assert.equal(production.images.unoptimized, false);
  const local = await load({ ...phone, NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:4320', NEXT_PUBLIC_MEDIA_HOSTS: '127.0.0.1:48333' });
  assert.equal(local.allowedDevOrigins, undefined);
  assert.equal(local.images.unoptimized, true);
  assert.equal(local.images.dangerouslyAllowLocalIP, undefined);
});

test('actual installed Next dev guard accepts configured phone websocket origin and refuses another host', async () => {
  const config = await load(phone);
  const response = () => ({ statusCode: 200, end() {} });
  assert.equal(blockCrossSiteDEV({ url: '/_next/webpack-hmr', headers: { origin: phone.NEXT_PUBLIC_APP_URL } }, response(), config.allowedDevOrigins, '127.0.0.1'), false);
  const denied = response();
  assert.equal(blockCrossSiteDEV({ url: '/_next/webpack-hmr', headers: { origin: 'https://foreign.test' } }, denied, config.allowedDevOrigins, '127.0.0.1'), true);
  assert.equal(denied.statusCode, 403);
});

test('malformed or unrelated HTTPS origin cannot widen private development access', async () => {
  for (const origin of ['https://foreign.test:8445', 'https://example.ts.net:8445/path', 'https://user@example.ts.net:8445', 'https://example.ts.net:8445?origin=other'])
    await assert.rejects(load({ ...phone, NEXT_PUBLIC_APP_URL: origin }), /Invalid private development origin/);
});
