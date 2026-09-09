'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  JOURNEY,
  assertPrivateEnvironmentFile,
  parsePrivateEnvironment,
  redactDatabaseUrl,
  validatePrivateEnvironment,
} = require('./config.cjs');

function validEnvironment() {
  return {
    ISNTGRAM_JOURNEY_PG_PASSWORD: 'pg-secret',
    ISNTGRAM_JOURNEY_FIXTURE_PASSWORD: 'fixture-secret',
    JWT_SECRET: 'jwt-secret',
    AUTH_SECRET: 'auth-secret',
    NEXTAUTH_SECRET: 'auth-secret',
    DATABASE_URL:
      'postgresql://isntgram_dev:pg-secret@127.0.0.1:55431/isntgram_journey',
    NODE_ENV: 'production',
    DATABASE_SSL: 'false',
    HOST: '127.0.0.1',
    PORT: '4311',
    CORS_ORIGIN: 'http://127.0.0.1:4310',
    NEXTAUTH_URL: 'http://127.0.0.1:4310',
    NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:4310',
    INTERNAL_API_URL: 'http://127.0.0.1:4311',
    NEXT_PUBLIC_API_URL: 'http://127.0.0.1:4311',
    DEMO_ENABLED: 'false',
    NEXT_PUBLIC_DEMO_ENABLED: 'false',
  };
}

test('accepts only the fixed private journey topology', () => {
  assert.equal(
    validatePrivateEnvironment(validEnvironment()).HOST,
    JOURNEY.host,
  );
});

test('rejects unsafe shell syntax and forbidden external credentials', () => {
  assert.throws(
    () => parsePrivateEnvironment('DATABASE_URL=$(bad)'),
    /unsupported assignment/,
  );
  assert.throws(
    () =>
      validatePrivateEnvironment({
        ...validEnvironment(),
        S3_BUCKET: 'external',
      }),
    /S3_BUCKET/,
  );
});

test('redacts passwords from database URLs', () => {
  const redacted = redactDatabaseUrl(validEnvironment().DATABASE_URL);
  assert.equal(redacted, 'postgresql://127.0.0.1:55431/isntgram_journey');
  assert.doesNotMatch(redacted, /pg-secret|isntgram_dev/);
});

test('accepts a private environment file and refuses unsafe filesystem topology', () => {
  const temporary = fs.mkdtempSync(
    path.join(os.tmpdir(), 'isntgram-journey-config-'),
  );
  try {
    fs.chmodSync(temporary, 0o700);
    const file = path.join(temporary, 'env.sh');
    fs.writeFileSync(file, "export NODE_ENV='production'\n", { mode: 0o600 });
    assert.doesNotThrow(() => assertPrivateEnvironmentFile(file));

    fs.chmodSync(temporary, 0o755);
    assert.throws(
      () => assertPrivateEnvironmentFile(file),
      /directory must be mode 0700/,
    );
    fs.chmodSync(temporary, 0o700);

    fs.chmodSync(file, 0o644);
    assert.throws(
      () => assertPrivateEnvironmentFile(file),
      /file must be mode 0600/,
    );
    fs.chmodSync(file, 0o600);

    const link = path.join(temporary, 'env-link.sh');
    fs.symlinkSync(file, link);
    assert.throws(
      () => assertPrivateEnvironmentFile(link),
      /must not be a symlink/,
    );
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
