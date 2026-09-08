'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { STATE, load, native, nativeEnv, statePath, args } = require('./config.cjs');
const { freePorts } = require('./preflight.cjs');
const {
  PORTS,
  storagePaths,
  verifyInstalled,
  identityText,
  assertServerConfiguration,
  assertResources,
} = require('./storage.cjs');

const MODE = 0o700;
const TARGET_NAMES = Object.freeze([
  's3-server.sock',
  'seaweedfs-s3-grpc-58333.sock',
]);

function fail(message) {
  throw new Error(`V1 retained-socket recovery refused: ${message}`);
}
function socketTargets(paths = storagePaths()) {
  const targets = [
    paths.s3ServerSocket,
    '/tmp/seaweedfs-s3-grpc-58333.sock',
  ];
  if (targets.length !== 2 || new Set(targets).size !== 2) fail('target set differs');
  if (path.basename(targets[0]) !== TARGET_NAMES[0] || path.basename(targets[1]) !== TARGET_NAMES[1])
    fail('target names differ');
  statePath(targets[0]);
  return targets;
}
function canonicalUnixPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) return null;
  const cleaned = value.split('->', 1)[0].replace(/\s+\(deleted\)$/, '').trim();
  return cleaned === '/tmp' || cleaned.startsWith('/tmp/')
    ? path.join('/private/tmp', cleaned.slice('/tmp'.length))
    : path.normalize(cleaned);
}
function assertPathBoundary(targets, fsApi = fs) {
  const [owned, temporary] = targets;
  statePath(owned);
  const ownedParent = path.dirname(owned);
  if (fsApi.realpathSync(ownedParent) !== ownedParent) fail('owned socket parent is indirect');
  if (fsApi.realpathSync('/tmp') !== '/private/tmp') fail('system temporary path differs');
  if (canonicalUnixPath(temporary) !== '/private/tmp/seaweedfs-s3-grpc-58333.sock')
    fail('temporary socket path differs');
}
function lstat(target, fsApi = fs) {
  try {
    return fsApi.lstatSync(target);
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    fail('socket path is inaccessible');
  }
}
function isPlainRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}
function receiptDigest(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
function assertExpectedDigest(expected, bytes) {
  if (!/^[a-f0-9]{64}$/.test(expected || '') || receiptDigest(bytes) !== expected)
    fail('receipt digest differs');
}
function readPrivateReceipt(file, expectedDigest, fsApi = fs) {
  const resolved = path.resolve(file);
  const evidence = path.join(STATE, 'evidence');
  if (!resolved.startsWith(evidence + path.sep)) fail('receipt is outside private evidence');
  statePath(resolved);
  const stat = lstat(resolved, fsApi);
  if (!stat || !stat.isFile() || stat.isSymbolicLink() || stat.uid !== process.getuid() ||
      (stat.mode & 0o777) !== 0o600) fail('receipt is not a private regular file');
  const bytes = fsApi.readFileSync(resolved);
  assertExpectedDigest(expectedDigest, bytes);
  try {
    const value = JSON.parse(String(bytes));
    if (!isPlainRecord(value)) fail('receipt has invalid shape');
    return { file: resolved, value, digest: expectedDigest };
  } catch (error) {
    if (String(error.message).includes('retained-socket recovery refused')) throw error;
    fail('receipt is not valid JSON');
  }
}
function provenanceReceipts(receipt, fsApi = fs) {
  if (!isPlainRecord(receipt.provenance)) return;
  const hashes = receipt.provenance.sourceReceiptHashes;
  const names = [
    'storage-server-native-first.json',
    'storage-server-stop-intent.json',
    'storage-server-stopped.json',
  ];
  if (!isPlainRecord(hashes) || Object.keys(hashes).sort().join(',') !== names.slice().sort().join(','))
    fail('derived receipt provenance differs');
  return Object.fromEntries(names.map((name) => [
    name,
    readPrivateReceipt(path.join(STATE, 'evidence', name), hashes[name], fsApi).value,
  ]));
}
function sameIdentity(left, right) {
  return isPlainRecord(left) && isPlainRecord(right) && left.pid === right.pid &&
    left.executable === right.executable && left.started === right.started;
}
function assertDerivedProvenance(receipt, targets, fsApi = fs) {
  const sources = provenanceReceipts(receipt, fsApi);
  if (!sources) return;
  const nativeFirst = sources['storage-server-native-first.json'];
  const intent = sources['storage-server-stop-intent.json'];
  const stopped = sources['storage-server-stopped.json'];
  if (!sameIdentity(receipt.identity, intent.identity) ||
      !sameIdentity(receipt.identity, nativeFirst.owned) ||
      !sameIdentity(receipt.identity, nativeFirst.qualified) ||
      stopped.pid !== receipt.identity.pid || stopped.processAbsent !== true ||
      stopped.tcpListenersAbsent !== true) fail('derived receipt identity differs');
  const byPath = new Map(receipt.sockets.map((socket) => [socket.path, socket]));
  for (const target of targets) {
    const expected = byPath.get(target);
    const source = intent.sockets?.find((socket) => socket.path === target);
    const after = stopped.sockets?.find((socket) => socket.path === target);
    const first = nativeFirst.sockets?.find((socket) => socket.path === target);
    if (!expected || !source || !after || !first || source.dev !== expected.dev ||
        source.ino !== expected.ino || source.uid !== expected.uid || source.mode !== expected.mode ||
        after.exists !== true || after.isSocket !== true || after.sameInode !== true ||
        after.dev !== expected.dev || after.ino !== expected.ino || first.exists !== true ||
        first.socket !== true || first.uid !== expected.uid || first.mode !== '700')
      fail('derived receipt socket provenance differs');
  }
}
function receiptSockets(receipt) {
  const sockets = receipt.sockets || receipt.qualification?.sockets;
  if (!Array.isArray(sockets)) fail('before-stop socket association is absent');
  return sockets;
}
function verifyBeforeStop(receipt, targets, installed, fsApi = fs) {
  const identity = receipt.identity;
  if (!isPlainRecord(identity) || !Number.isSafeInteger(identity.pid) || identity.pid < 2 ||
      identity.executable !== installed.executable || typeof identity.started !== 'string' || !identity.started)
    fail('before-stop process identity differs');
  const q = receipt.qualification;
  if (!isPlainRecord(q) || q.pid !== identity.pid || q.executable !== identity.executable ||
      q.started !== identity.started || q.cwd !== storagePaths().root || q.uid !== process.getuid() ||
      !Array.isArray(q.ports) || q.ports.length !== PORTS.length ||
      q.ports.some((port, index) => port !== PORTS[index]))
    fail('before-stop qualification differs');
  const after = receipt.afterStop;
  if (!isPlainRecord(after) || after.pid !== identity.pid || after.processAbsent !== true ||
      after.foregroundSessionExited !== true || after.tcpListenersAbsent !== true)
    fail('after-stop process evidence differs');
  const expected = new Map(receiptSockets(receipt).map((socket) => [socket.path, socket]));
  for (const target of targets) {
    const socket = expected.get(target);
    if (!isPlainRecord(socket) || !Number.isSafeInteger(socket.dev) || !Number.isSafeInteger(socket.ino) ||
        socket.dev < 1 || socket.ino < 1 || socket.uid !== process.getuid() || socket.mode !== MODE ||
        socket.isSocket !== true || socket.nativeAssociated !== true) fail('before-stop socket identity differs');
  }
  assertDerivedProvenance(receipt, targets, fsApi);
  return expected;
}
function absentProcess(pid, execute = native) {
  try {
    const output = execute('/bin/ps', ['-p', String(pid), '-o', 'pid=']);
    if (String(output).trim()) fail('identified process is still running');
  } catch (error) {
    if (error && error.status === 1 && !String(error.stdout || '').trim()) return;
    if (String(error.message).includes('retained-socket recovery refused')) throw error;
    fail('process-exit inspection is unavailable');
  }
}
function unixInventory(run = spawnSync) {
  const result = run('/usr/sbin/lsof', ['-nP', '-U', '-Fn'], {
    cwd: process.cwd(), env: nativeEnv(), encoding: 'utf8', timeout: 5000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stdout = String(result?.stdout || '');
  const stderr = String(result?.stderr || '');
  if (result?.error || stderr.trim() || ![0, 1].includes(result?.status) ||
      (result.status === 1 && stdout.trim())) fail('Unix-socket inventory is unavailable');
  return stdout;
}
function noSocketAssociation(targets, run = spawnSync) {
  const wanted = new Set(targets.map(canonicalUnixPath));
  for (const line of unixInventory(run).split(/\r?\n/)) {
    if (!line.startsWith('n')) continue;
    if (wanted.has(canonicalUnixPath(line.slice(1)))) fail('retained socket still has a process association');
  }
}
function assertStopped(receipt, targets, execute = native, run = spawnSync) {
  absentProcess(receipt.identity.pid, execute);
  freePorts(PORTS, execute);
  noSocketAssociation(targets, run);
}
function privatePreparedDirectory(target, fsApi = fs) {
  const stat = lstat(target, fsApi);
  if (!stat || stat.isSymbolicLink() || !stat.isDirectory() ||
      stat.uid !== process.getuid() || (stat.mode & 0o777) !== MODE)
    fail('prepared storage directory differs');
}
function assertPreparedServer(c, paths, execute = native, fsApi = fs) {
  assertServerConfiguration(paths);
  assertResources(paths, execute);
  for (const target of [paths.dataServer, paths.configServer, paths.homeServer, paths.logsServer])
    privatePreparedDirectory(target, fsApi);
  const identity = lstat(paths.identities, fsApi);
  if (!identity || identity.isSymbolicLink() || !identity.isFile() ||
      identity.uid !== process.getuid() || (identity.mode & 0o777) !== 0o600 ||
      fsApi.readFileSync(paths.identities, 'utf8') !== identityText(c, paths))
    fail('prepared storage identity differs');
}
function currentSocket(target, expected, fsApi = fs) {
  const stat = lstat(target, fsApi);
  if (!stat) return { target, absent: true };
  if (stat.isSymbolicLink() || !stat.isSocket() || stat.uid !== process.getuid() ||
      (stat.mode & 0o777) !== MODE || stat.dev !== expected.dev || stat.ino !== expected.ino)
    fail('retained socket identity changed');
  return { target, absent: false, dev: stat.dev, ino: stat.ino, uid: stat.uid, mode: stat.mode & 0o777 };
}
function inspect(beforeStopReceipt, expectedReceiptSha256, { paths = storagePaths(), execute = native, run = spawnSync, fsApi = fs } = {}) {
  const c = load();
  const targets = socketTargets(paths);
  assertPathBoundary(targets, fsApi);
  const installed = verifyInstalled(paths);
  assertPreparedServer(c, paths, execute, fsApi);
  const { file, value, digest } = readPrivateReceipt(beforeStopReceipt, expectedReceiptSha256, fsApi);
  const expected = verifyBeforeStop(value, targets, installed, fsApi);
  assertStopped(value, targets, execute, run);
  return {
    receipt: file,
    receiptSha256: digest,
    pid: value.identity.pid,
    executable: installed.executable,
    targets: targets.map((target) => currentSocket(target, expected.get(target), fsApi)),
    config: { root: c.root, webOrigin: c.webOrigin },
  };
}
function safeError(error) {
  const names = new Set(['Error', 'TypeError', 'RangeError']);
  const codes = new Set(['EACCES', 'EEXIST', 'EIO', 'ENOENT', 'EPERM']);
  return {
    name: names.has(error?.name) ? error.name : 'Error',
    code: codes.has(error?.code) ? error.code : null,
  };
}
function privateEvidenceDirectory(evidence, fsApi = fs) {
  statePath(evidence);
  const stat = lstat(evidence, fsApi);
  if (!stat || stat.isSymbolicLink() || !stat.isDirectory() ||
      stat.uid !== process.getuid() || (stat.mode & 0o777) !== MODE)
    fail('evidence directory is not private');
}
function writeJournal(record, { evidence = path.join(STATE, 'evidence'), fsApi = fs } = {}) {
  privateEvidenceDirectory(evidence, fsApi);
  const name = `storage-retained-sockets-${crypto.randomUUID()}.json`;
  const file = path.join(evidence, name);
  statePath(file);
  fsApi.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  return {
    file,
    update(next) {
      fsApi.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'w' });
    },
  };
}
function remove(beforeStopReceipt, expectedReceiptSha256, options = {}) {
  const checked = inspect(beforeStopReceipt, expectedReceiptSha256, options);
  const journal = writeJournal({
    operation: 'remove-retained-sockets',
    beforeStopReceipt: checked.receipt,
    receiptSha256: checked.receiptSha256,
    pid: checked.pid,
    stage: 'validated-before-mutation',
    targets: checked.targets,
  }, options);
  const events = [];
  try {
    for (const prior of checked.targets) {
      const live = inspect(beforeStopReceipt, expectedReceiptSha256, options).targets.find((entry) => entry.target === prior.target);
      journal.update({ operation: 'remove-retained-sockets', beforeStopReceipt: checked.receipt, receiptSha256: checked.receiptSha256, pid: checked.pid,
        stage: 'before-unlink', events, target: live });
      if (live.absent) events.push({ target: live.target, action: 'already-absent' });
      else {
        (options.fsApi || fs).unlinkSync(live.target);
        if (lstat(live.target, options.fsApi || fs)) fail('socket remains after unlink');
        events.push({ target: live.target, action: 'unlinked', dev: live.dev, ino: live.ino });
      }
    }
    journal.update({ operation: 'remove-retained-sockets', beforeStopReceipt: checked.receipt, receiptSha256: checked.receiptSha256, pid: checked.pid,
      stage: 'complete', events });
    return { journal: journal.file, events };
  } catch (error) {
    journal.update({ operation: 'remove-retained-sockets', beforeStopReceipt: checked.receipt, receiptSha256: checked.receiptSha256, pid: checked.pid,
      stage: 'failed', events, failure: safeError(error) });
    throw error;
  }
}
function main() {
  const [operation, beforeStopReceipt, expectedReceiptSha256] = args(3);
  if (!['inspect', 'remove'].includes(operation) || !beforeStopReceipt ||
      !/^[a-f0-9]{64}$/.test(expectedReceiptSha256))
    fail('usage: storage-retained-sockets.cjs inspect|remove <private-before-stop-receipt> <reviewed-sha256>');
  const result = operation === 'inspect'
    ? inspect(beforeStopReceipt, expectedReceiptSha256)
    : remove(beforeStopReceipt, expectedReceiptSha256);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (require.main === module)
  try {
    main();
  } catch {
    console.error('V1 retained-socket recovery refused. Inspect private recovery receipt; no automatic retry.');
    process.exitCode = 1;
  }
module.exports = {
  socketTargets, canonicalUnixPath, assertPathBoundary, receiptDigest, assertExpectedDigest,
  readPrivateReceipt, provenanceReceipts, assertDerivedProvenance, verifyBeforeStop, unixInventory, noSocketAssociation, currentSocket,
  assertPreparedServer, privateEvidenceDirectory, inspect, remove,
};
