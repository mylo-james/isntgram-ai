'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { assertExpectedPort, inspectPort } = require('./preflight.cjs');
const { JOURNEY, assertStatePath } = require('./config.cjs');
const { spawnSync } = require('node:child_process');
const { FIXTURE, prepareFixture } = require('./fixture.cjs');
const { verifyPost } = require('./verify.cjs');

test('native port guard refuses an owned temporary sentinel without signalling it', async () => {
  const server = net.createServer();
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => resolve(undefined));
    });
  } catch (error) { throw error; }
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing sentinel address');
    const port = address.port;
    const observed = inspectPort(port);
    assert.ok(observed.includes(process.pid));
    assert.throws(
      () => assertExpectedPort(port, observed),
      /occupied/,
    );
    assert.equal(server.listening, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('state guard rejects an actual symlink before following it', () => {
  const temporary = fs.mkdtempSync(
    path.join(JOURNEY.root, '.journey-guard-test-path-'),
  );
  try {
    const target = path.join(temporary, 'target');
    const link = path.join(temporary, 'link');
    fs.mkdirSync(target);
    fs.symlinkSync(target, link);
    assert.throws(() => assertStatePath(link), /symlink/);
    assert.doesNotThrow(() => assertStatePath(target));
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('matching fixture does not insert or overwrite rows', async () => {
  const calls = [];
  const client = {
    query: async (sql, values) => {
      calls.push([sql, values]);
      if (sql.startsWith('SELECT id, username'))
        return {
          rowCount: 1,
          rows: [
            {
              id: FIXTURE.userId,
              username: FIXTURE.username,
              email: FIXTURE.email,
              hashedPassword: '$argon2id$synthetic',
              demoExpiresAt: null,
              isDemoUser: false,
              isDemoSeed: false,
            },
          ],
        };
      if (sql.startsWith('SELECT id, "authorId"'))
        return {
          rowCount: 1,
          rows: [
            {
              id: FIXTURE.postId,
              authorId: FIXTURE.userId,
              content: FIXTURE.content,
              mediaUrl: null,
            },
          ],
        };
      return { rowCount: 0, rows: [] };
    },
  };
  const argon2 = {
    ...require('argon2'),
    argon2id: require('argon2').argon2id,
    hash: async () => 'hash',
    verify: async () => true,
  };
  await prepareFixture(client, { argon2, password: 'synthetic' });
  assert.match(calls[1][0], /pg_advisory_xact_lock/);
  assert.equal(calls.some(([sql]) => /^(INSERT|UPDATE|DELETE|TRUNCATE)/.test(sql)), false);
  assert.equal(calls.at(-1)[0], 'COMMIT');
});

test('verification uses a read-only transaction and validates IDs', async () => {
  const calls = [];
  const client = {
    query: async (sql, values) => {
      calls.push([sql, values]);
      return sql.startsWith('SELECT')
        ? { rowCount: 1, rows: [{ id: FIXTURE.postId }] }
        : { rowCount: 0, rows: [] };
    },
  };
  await verifyPost(FIXTURE.postId, client);
  assert.equal(calls[0][0], 'BEGIN READ ONLY');
  assert.equal(calls.at(-1)[0], 'COMMIT');
  await assert.rejects(() => verifyPost('not-a-uuid', client), /UUID/);
});


test('wrong checkout CLI refuses before creating state', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'isntgram-wrong-checkout-'));
  try {
    const result = spawnSync(process.execPath, [path.join(__dirname, 'preflight.cjs'), 'bootstrap'], { cwd: temporary, encoding: 'utf8', timeout: 5000 });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.deepEqual(fs.readdirSync(temporary), []);
  } finally { fs.rmSync(temporary, { recursive: true }); }
});
