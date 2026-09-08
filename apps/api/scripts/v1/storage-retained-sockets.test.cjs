'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { storagePaths } = require('./storage.cjs');
const {
  STATE,
} = require('./config.cjs');
const {
  canonicalUnixPath,
  receiptDigest,
  assertExpectedDigest,
  assertDerivedProvenance,
  socketTargets,
  noSocketAssociation,
  currentSocket,
  verifyBeforeStop,
} = require('./storage-retained-sockets.cjs');

const [owned, temporary] = socketTargets(storagePaths());
const installed = { executable: '/owned/bin/weed' };
function receipt(overrides = {}) {
  return {
    identity: { pid: 7123, executable: installed.executable, started: 'Mon Sep 7 22:51:21 2026' },
    qualification: {
      pid: 7123,
      executable: installed.executable,
      started: 'Mon Sep 7 22:51:21 2026',
      cwd: storagePaths().root,
      uid: process.getuid(),
      ports: [48331, 48332, 48333, 48334, 58331, 58332, 58333, 58334],
    },
    sockets: [
      { path: owned, dev: 11, ino: 12, uid: process.getuid(), mode: 0o700, isSocket: true, nativeAssociated: true },
      { path: temporary, dev: 11, ino: 13, uid: process.getuid(), mode: 0o700, isSocket: true, nativeAssociated: true },
    ],
    afterStop: { pid: 7123, processAbsent: true, foregroundSessionExited: true, tcpListenersAbsent: true },
    ...overrides,
  };
}

function sourceReceiptBytes(value) {
  return Buffer.from(`${JSON.stringify(value)}\n`);
}

function syntheticProvenance(receiptValue) {
  const identity = receiptValue.identity;
  const sources = {
    'storage-server-native-first.json': {
      owned: identity,
      qualified: identity,
      sockets: receiptValue.sockets.map(({ path: socketPath, uid }) => ({
        path: socketPath, exists: true, socket: true, uid, mode: '700',
      })),
    },
    'storage-server-stop-intent.json': {
      identity,
      sockets: receiptValue.sockets.map(({ path: socketPath, dev, ino, uid, mode }) => ({
        path: socketPath, dev, ino, uid, mode,
      })),
    },
    'storage-server-stopped.json': {
      pid: identity.pid,
      processAbsent: true,
      tcpListenersAbsent: true,
      sockets: receiptValue.sockets.map(({ path: socketPath, dev, ino }) => ({
        path: socketPath, exists: true, isSocket: true, sameInode: true, dev, ino,
      })),
    },
  };
  const files = new Map(Object.entries(sources).map(([name, value]) => {
    const bytes = sourceReceiptBytes(value);
    return [path.join(STATE, 'evidence', name), bytes];
  }));
  const fsApi = {
    lstatSync(file) {
      if (!files.has(file)) {
        const error = new Error('synthetic receipt is unavailable');
        error.code = 'ENOENT';
        throw error;
      }
      return {
        uid: process.getuid(), mode: 0o600,
        isFile: () => true, isSymbolicLink: () => false,
      };
    },
    readFileSync(file) {
      const bytes = files.get(file);
      if (!bytes) throw new Error('synthetic receipt is unavailable');
      return bytes;
    },
  };
  return {
    fsApi,
    hashes: Object.fromEntries([...files].map(([file, bytes]) => [path.basename(file), receiptDigest(bytes)])),
  };
}

test('binds a receipt to the reviewed SHA-256 and refuses tampering', () => {
  const bytes = Buffer.from('{\"receipt\":true}');
  const digest = receiptDigest(bytes);
  assert.doesNotThrow(() => assertExpectedDigest(digest, bytes));
  assert.throws(() => assertExpectedDigest(digest, Buffer.from('{\"receipt\":false}')), /digest differs/);
  assert.throws(() => assertExpectedDigest('a'.repeat(63), bytes), /digest differs/);
});

test('accepts hash-consistent synthetic provenance and refuses a mutated consolidated socket fact', () => {
  const actual = receipt();
  const provenance = syntheticProvenance(actual);
  actual.provenance = { sourceReceiptHashes: provenance.hashes };
  assert.doesNotThrow(() => assertDerivedProvenance(actual, socketTargets(storagePaths()), provenance.fsApi));

  actual.sockets.find((socket) => socket.path === owned).ino += 1;
  assert.throws(
    () => assertDerivedProvenance(actual, socketTargets(storagePaths()), provenance.fsApi),
    /socket provenance differs/,
  );
});

test('normalizes /tmp aliases and lsof peer suffixes', () => {
  assert.equal(canonicalUnixPath('/tmp/a.sock'), '/private/tmp/a.sock');
  assert.equal(canonicalUnixPath('/private/tmp/a.sock'), '/private/tmp/a.sock');
  assert.equal(canonicalUnixPath('/tmp/a.sock -> /tmp/b.sock'), '/private/tmp/a.sock');
  assert.equal(canonicalUnixPath('/tmp/a.sock (deleted)'), '/private/tmp/a.sock');
  assert.equal(canonicalUnixPath('not-a-path'), null);
});

test('rejects a before-stop receipt without cwd or matching socket evidence', () => {
  assert.throws(() => verifyBeforeStop(receipt({ qualification: { ...receipt().qualification, cwd: undefined } }), [owned, temporary], installed), /qualification differs/);
  assert.throws(() => verifyBeforeStop(receipt({ sockets: [receipt().sockets[0]] }), [owned, temporary], installed), /socket identity differs/);
});

test('rejects a retained socket replacement, regular file, and indirect path', () => {
  const expected = receipt().sockets[0];
  const base = { uid: process.getuid(), mode: 0o700, dev: 11, ino: 12, isSocket: () => true, isSymbolicLink: () => false };
  assert.equal(currentSocket(owned, expected, { lstatSync: () => base }).absent, false);
  assert.throws(() => currentSocket(owned, expected, { lstatSync: () => ({ ...base, ino: 99 }) }), /identity changed/);
  assert.throws(() => currentSocket(owned, expected, { lstatSync: () => ({ ...base, isSocket: () => false }) }), /identity changed/);
  assert.throws(() => currentSocket(owned, expected, { lstatSync: () => ({ ...base, isSymbolicLink: () => true }) }), /identity changed/);
});

test('refuses both /tmp and /private/tmp associations from a complete Unix inventory', () => {
  assert.throws(
    () => noSocketAssociation([owned, temporary], () => ({ status: 0, stdout: 'p99\nn/private/tmp/seaweedfs-s3-grpc-58333.sock\n', stderr: '' })),
    /process association/,
  );
  assert.throws(
    () => noSocketAssociation([owned, temporary], () => ({ status: 0, stdout: `p99\nn${owned} -> /tmp/peer.sock\n`, stderr: '' })),
    /process association/,
  );
  assert.doesNotThrow(() => noSocketAssociation([owned, temporary], () => ({ status: 0, stdout: 'p99\nn/tmp/other.sock\n', stderr: '' })));
});

test('refuses a Unix inventory warning or partial output', () => {
  assert.throws(() => noSocketAssociation([owned, temporary], () => ({ status: 0, stdout: '', stderr: 'warning' })), /inventory is unavailable/);
  assert.throws(() => noSocketAssociation([owned, temporary], () => ({ status: 1, stdout: 'p99', stderr: '' })), /inventory is unavailable/);
});

test('uses the production socket targets', () => {
  assert.deepEqual(socketTargets(storagePaths()), [owned, temporary]);
  assert.equal(path.basename(owned), 's3-server.sock');
  assert.equal(path.basename(temporary), 'seaweedfs-s3-grpc-58333.sock');
});
