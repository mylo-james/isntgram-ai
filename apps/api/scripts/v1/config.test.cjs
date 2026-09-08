'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  FIXED,
  SECRET_KEYS,
  appEnvironment,
  browserOrigins,
  validate,
} = require('./config.cjs');

function validConfig(phoneView) {
  return {
    ...FIXED,
    systemId: null,
    demoReady: true,
    secrets: Object.fromEntries(
      SECRET_KEYS.map((key) => [key, 'a'.repeat(32)]),
    ),
    tools: { node: 'b'.repeat(64), postgres: 'c'.repeat(64) },
    ...(phoneView === undefined ? {} : { phoneView }),
  };
}

const phoneView = Object.freeze({
  webOrigin: 'https://isntgram-phone.example.ts.net:8445',
  s3Origin: 'https://isntgram-phone.example.ts.net:8446',
  serveWebPort: 8445,
  serveS3Port: 8446,
});

test('ordinary local configuration and environment stay byte-identical', () => {
  const c = validate(validConfig());
  assert.deepEqual(browserOrigins(c), [FIXED.webOrigin]);
  const env = appEnvironment(c);
  assert.equal(env.NEXTAUTH_URL, FIXED.webOrigin);
  assert.equal(env.NEXT_PUBLIC_APP_URL, FIXED.webOrigin);
  assert.equal(env.S3_ENDPOINT, FIXED.storageEndpoint);
  assert.equal(env.S3_PUBLIC_BASE_URL, `${FIXED.storageEndpoint}/${FIXED.bucket}`);
  assert.equal(env.S3_PRESIGN_ENDPOINT, undefined);
  assert.equal(env.S3_DISPLAY_BASE_URL, undefined);
  assert.equal(env.NEXT_PUBLIC_MEDIA_HOSTS, '127.0.0.1:48333');
});

test('validated phone view derives only the external browser endpoints', () => {
  const c = validate(validConfig(phoneView));
  assert.deepEqual(browserOrigins(c), [FIXED.webOrigin, phoneView.webOrigin]);
  const env = appEnvironment(c);
  assert.equal(env.S3_ENDPOINT, FIXED.storageEndpoint);
  assert.equal(env.S3_PUBLIC_BASE_URL, `${FIXED.storageEndpoint}/${FIXED.bucket}`);
  assert.equal(env.S3_PRESIGN_ENDPOINT, phoneView.s3Origin);
  assert.equal(env.S3_DISPLAY_BASE_URL, `${phoneView.s3Origin}/${FIXED.bucket}`);
  assert.equal(env.NEXTAUTH_URL, phoneView.webOrigin);
  assert.equal(env.NEXT_PUBLIC_APP_URL, phoneView.webOrigin);
  assert.equal(
    env.NEXT_PUBLIC_MEDIA_HOSTS,
    '127.0.0.1:48333,isntgram-phone.example.ts.net:8446',
  );
});

test('phone view refuses non-exact origins, unsafe hosts, ports, and extra fields', () => {
  const invalid = [
    { ...phoneView, webOrigin: 'http://isntgram-phone.example.ts.net:8445' },
    { ...phoneView, webOrigin: 'https://127.0.0.1:8445' },
    { ...phoneView, webOrigin: 'https://isntgram-phone.example.ts.net:8445/path' },
    { ...phoneView, webOrigin: 'https://isntgram-phone.example.ts.net:8445?x=1' },
    { ...phoneView, webOrigin: 'https://user@isntgram-phone.example.ts.net:8445' },
    { ...phoneView, webOrigin: 'https://*.example.ts.net:8445' },
    { ...phoneView, s3Origin: 'https://other.example.ts.net:8446' },
    { ...phoneView, s3Origin: phoneView.webOrigin, serveS3Port: 8445 },
    { ...phoneView, serveWebPort: 8443 },
    { ...phoneView, unexpected: true },
  ];
  for (const candidate of invalid)
    assert.throws(() => validate(validConfig(candidate)), /phone|inconsistent/);
});
