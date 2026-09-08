'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  FIXED,
  SECRET_KEYS,
  assertEnvironment,
  statePath,
  validate,
} = require('./config.cjs');
const { freePorts, listeners } = require('./preflight.cjs');
const { run } = require('./db.cjs');

function validConfig() {
  return {
    ...FIXED,
    systemId: null,
    demoReady: false,
    secrets: Object.fromEntries(SECRET_KEYS.map((key) => [key, 'a'.repeat(32)])),
    tools: { node: 'b'.repeat(64), postgres: 'c'.repeat(64) },
  };
}

test('configuration validation rejects unexpected fixed fields and weak private values', () => {
  const withExtraField = { ...validConfig(), extra: true };
  assert.throws(() => validate(withExtraField), /unexpected fields/);

  const wrongRole = { ...validConfig(), appRole: 'postgres' };
  assert.throws(() => validate(wrongRole), /unexpected appRole/);

  const wrongPort = { ...validConfig(), port: 5432 };
  assert.throws(() => validate(wrongPort), /unexpected port/);

  const weakSecret = validConfig();
  weakSecret.secrets.ISNTGRAM_V1_APP_DB_PASSWORD = 'too-short';
  assert.throws(() => validate(weakSecret), /invalid private credential shape/);
});

test('configuration rejects inherited database settings and loadable dotenv input', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'isntgram-v1-guards-'));
  try {
    assert.throws(
      () => assertEnvironment({ PGHOST: '127.0.0.1' }, root),
      /inherited application or runtime configuration/,
    );

    fs.writeFileSync(path.join(root, '.env'), 'DATABASE_URL=ignored\n');
    assert.throws(() => assertEnvironment({}, root), /loadable dotenv file/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('state-path validation rejects a symlinked local state segment', () => {
  const root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'isntgram-v1-state-')),
  );
  const outside = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'isntgram-v1-outside-')),
  );
  try {
    fs.symlinkSync(outside, path.join(root, '.local'));
    const state = path.join(root, '.local', 'v1');
    assert.throws(
      () => statePath(path.join(state, 'config.json'), { root, state }),
      /state path is unowned or indirect/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test('preflight refuses occupied ports and unavailable listener inspection', () => {
  assert.throws(
    () => freePorts([55432], () => 'p777\n'),
    /port 55432 is occupied/,
  );

  const executionFailure = Object.assign(new Error('lsof unavailable'), {
    status: 2,
    stdout: '',
    stderr: 'permission denied',
  });
  assert.throws(
    () => listeners(55432, () => { throw executionFailure; }),
    /listener inspection unavailable/,
  );
});

test('database entrypoint rejects an unknown action before loading configuration', async () => {
  await assert.rejects(() => run('erase'), /Unexpected db action/);
});
