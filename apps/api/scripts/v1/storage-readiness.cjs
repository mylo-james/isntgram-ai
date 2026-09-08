'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { HeadBucketCommand } = require('@aws-sdk/client-s3');
const config = require('./config.cjs');
const storage = require('./storage.cjs');
const preflight = require('./preflight.cjs');
const { createClient } = require('./storage-capabilities.cjs');

const WINDOW_MS = 60_000;
const PROBE_SPACING_MS = 10_000;
const MAX_PROBES = 6;
const NATIVE_TIMEOUT_CAP_MS = 8_000;
const HEAD_TIMEOUT_MS = 5_000;
const EVIDENCE_DIR = path.join(config.STATE, 'evidence');

function fail(message) {
  throw new Error(`V1 storage readiness refused: ${message}`);
}

function safeFailure(error) {
  const output = {};
  if (/^[A-Za-z][A-Za-z0-9_]{0,80}$/.test(error?.name || ''))
    output.name = error.name;
  if (/^[A-Za-z0-9_.-]{1,80}$/.test(error?.code || ''))
    output.code = error.code;
  const status = error?.$metadata?.httpStatusCode;
  if (Number.isInteger(status) && status >= 100 && status <= 599)
    output.httpStatus = status;
  return output;
}

function isLaunchReceiptPath(file) {
  const expectedParent = path.join(config.STATE, 'evidence');
  return (
    path.dirname(path.resolve(file)) === expectedParent &&
    /^storage-launch-[0-9a-f-]{36}\.json$/.test(path.basename(file))
  );
}

function privateRegular(file) {
  if (!isLaunchReceiptPath(file)) fail('launch receipt path differs');
  config.statePath(file);
  const stat = fs.lstatSync(file);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.uid !== process.getuid() ||
    (stat.mode & 0o777) !== 0o600
  )
    fail('launch receipt is not an owned mode-600 regular file');
  return stat;
}

function receiptHash(file) {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(file))
    .digest('hex');
}

function readLaunchReceipt(file, now, paths = storage.storagePaths()) {
  privateRegular(file);
  let receipt;
  try {
    receipt = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    fail('launch receipt is invalid JSON');
  }
  const expectedKeys = [
    'at',
    'binarySha256',
    'executable',
    'log',
    'pid',
    'started',
  ];
  if (
    !receipt ||
    typeof receipt !== 'object' ||
    Array.isArray(receipt) ||
    Object.keys(receipt).sort().join(',') !== expectedKeys.sort().join(',')
  )
    fail('launch receipt schema differs');
  const at = new Date(receipt.at);
  if (!Number.isFinite(at.getTime()) || at.toISOString() !== receipt.at)
    fail('launch receipt timestamp differs');
  if (at.getTime() > now || now - at.getTime() >= WINDOW_MS)
    fail('launch receipt is outside readiness window');
  if (!Number.isSafeInteger(receipt.pid) || receipt.pid < 2)
    fail('launch receipt PID differs');
  if (
    receipt.executable !== fs.realpathSync(paths.weed) ||
    receipt.binarySha256 !== storage.BINARY_SHA256 ||
    receipt.log !== path.join(paths.logsServer, `weed-${at.getTime()}.log`) ||
    typeof receipt.started !== 'string' ||
    !receipt.started.trim()
  )
    fail('launch receipt identity differs');
  return { ...receipt, atMs: at.getTime(), sha256: receiptHash(file) };
}

function probeTimes(atMs) {
  return Array.from(
    { length: MAX_PROBES },
    (_, index) => atMs + index * PROBE_SPACING_MS,
  );
}

function readinessReceiptPath() {
  return path.join(
    EVIDENCE_DIR,
    `storage-readiness-${crypto.randomUUID()}.json`,
  );
}

function writePrivateReceipt(file, value, flag = 'wx') {
  config.statePath(file);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const parent = fs.statSync(path.dirname(file));
  if (!parent.isDirectory() || (parent.mode & 0o777) !== 0o700)
    fail('readiness evidence directory differs');
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', {
    mode: 0o600,
    flag,
  });
  if ((fs.statSync(file).mode & 0o777) !== 0o600)
    fail('readiness receipt permissions differ');
}

function runNativeQualification(c, remaining, execute = execFileSync) {
  const timeout = Math.min(NATIVE_TIMEOUT_CAP_MS, remaining);
  if (timeout < HEAD_TIMEOUT_MS) fail('readiness deadline reached');
  const text = execute(
    path.join(c.nodeBin, 'node'),
    [path.join(__dirname, 'storage.cjs'), 'running'],
    {
      cwd: config.ROOT,
      env: config.nativeEnv(),
      encoding: 'utf8',
      timeout,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  try {
    return JSON.parse(String(text).trim());
  } catch {
    fail('native qualification output differs');
  }
}

function assertNativeIdentity(native, launch) {
  if (
    native?.pid !== launch.pid ||
    native?.executable !== launch.executable ||
    native?.started !== launch.started
  )
    fail('native qualification identity differs');
}

function startupTopologyNotReady(c, launch, paths = storage.storagePaths(), dependencies = {}) {
  const deps = {
    inspectOwnedProcess: storage.inspectOwnedProcess,
    assertNativeServerArgs: storage.assertNativeServerArgs,
    listeners: preflight.listeners,
    socketPathFromLsof: storage.socketPathFromLsof,
    socketPaths: storage.assertSocketPathLimits,
    lstat: fs.lstatSync,
    native: config.native,
    ...dependencies,
  };

  const identity = deps.inspectOwnedProcess(c, launch.pid, paths, deps.native);
  assertNativeIdentity(identity, launch);
  deps.assertNativeServerArgs(c, launch.pid, paths, deps.native);

  const portOwners = storage.PORTS.map((port) =>
    deps.listeners(port, deps.native),
  );
  const missingPort = portOwners.some((owners) => owners.length === 0);
  if (
    portOwners.some(
      (owners) =>
        owners.length > 0 && (owners.length !== 1 || owners[0] !== launch.pid),
    )
  )
    return false;

  const output = deps.native('/usr/sbin/lsof', [
    '-nP',
    '-a',
    '-p',
    String(launch.pid),
    '-U',
    '-Fn',
  ]);
  const listed = String(output)
    .split('\n')
    .filter((line) => line.startsWith('n'))
    .map((line) => deps.socketPathFromLsof(line.slice(1)))
    .filter((pathname) => pathname !== null);
  const actual = new Set(listed);
  const expected = new Set(deps.socketPaths(paths));
  if ([...actual].some((pathname) => !expected.has(pathname))) return false;
  let missingSocket = false;
  for (const socket of expected) {
    if (!actual.has(socket)) {
      missingSocket = true;
      continue;
    }
    const stat = deps.lstat(socket);
    if (
      !stat.isSocket() ||
      stat.uid !== process.getuid() ||
      (stat.mode & 0o077) !== 0
    )
      return false;
  }
  return missingPort || missingSocket;
}

function isTransientNotReady(error) {
  if (
    [
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'EPIPE',
      'UND_ERR_CONNECT_TIMEOUT',
      'STORAGE_STARTUP_NOT_READY',
    ].includes(error?.code)
  )
    return true;
  if (['AbortError', 'TimeoutError'].includes(error?.name)) return true;
  return [429, 502, 503, 504].includes(error?.$metadata?.httpStatusCode);
}

async function run(launchReceiptFile, dependencies = {}) {
  const deps = {
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    load: config.load,
    paths: storage.storagePaths,
    readLaunch: readLaunchReceipt,
    nativeQualification: runNativeQualification,
    createClient,
    HeadBucketCommand,
    startupTopologyNotReady,
    writeReceipt: writePrivateReceipt,
    receiptPath: readinessReceiptPath,
    ...dependencies,
  };
  const c = deps.load();
  const paths = deps.paths();
  const launch = deps.readLaunch(launchReceiptFile, deps.now(), paths);
  const deadline = launch.atMs + WINDOW_MS;
  const evidenceFile = deps.receiptPath();
  const result = {
    launchReceiptSha256: launch.sha256,
    launchStarted: launch.started,
    deadline: new Date(deadline).toISOString(),
    probes: [],
  };
  deps.writeReceipt(evidenceFile, { stage: 'allocated', ...result });
  const client = deps.createClient(c);
  try {
    for (const scheduled of probeTimes(launch.atMs)) {
      const before = deps.now();
      if (scheduled > before) await deps.sleep(scheduled - before);
      const started = deps.now();
      const remaining = deadline - started;
      if (remaining < 1) fail('readiness deadline reached');
      try {
        let native;
        try {
          native = deps.nativeQualification(c, remaining);
          assertNativeIdentity(native, launch);
        } catch (error) {
          let incompleteTopology = false;
          try {
            incompleteTopology = deps.startupTopologyNotReady(c, launch, paths);
          } catch {
            throw error;
          }
          if (!incompleteTopology) throw error;
          throw Object.assign(new Error('storage startup topology is incomplete'), {
            code: 'STORAGE_STARTUP_NOT_READY',
          });
        }
        const headRemaining = deadline - deps.now();
        if (headRemaining < 1) fail('readiness deadline reached');
        await client.send(new deps.HeadBucketCommand({ Bucket: c.bucket }), {
          abortSignal: AbortSignal.timeout(
            Math.min(HEAD_TIMEOUT_MS, headRemaining),
          ),
        });
        if (deps.now() > deadline) fail('readiness deadline reached');
        result.probes.push({
          elapsedMs: deps.now() - launch.atMs,
          nativeQualification: native,
          headBucket: 'passed',
        });
        result.passedElapsedMs = deps.now() - launch.atMs;
        deps.writeReceipt(evidenceFile, { stage: 'passed', ...result }, 'w');
        return { evidenceFile, result };
      } catch (error) {
        result.probes.push({
          elapsedMs: deps.now() - launch.atMs,
          headBucket: 'not-ready',
          failure: safeFailure(error),
        });
        deps.writeReceipt(evidenceFile, { stage: 'probing', ...result }, 'w');
        if (!isTransientNotReady(error)) throw error;
      }
    }
    fail('storage did not become ready in launch window');
  } catch (error) {
    deps.writeReceipt(
      evidenceFile,
      { stage: 'failed', ...result, failure: safeFailure(error) },
      'w',
    );
    throw error;
  } finally {
    client.destroy?.();
  }
}

if (require.main === module)
  Promise.resolve()
    .then(() => run(config.args(1)[0]))
    .then(({ evidenceFile, result }) =>
      console.log(
        JSON.stringify({
          evidenceFile,
          passedElapsedMs: result.passedElapsedMs,
        }),
      ),
    )
    .catch(() => {
      console.error(
        'Storage readiness refused; inspect the private readiness receipt.',
      );
      process.exitCode = 1;
    });

module.exports = {
  WINDOW_MS,
  PROBE_SPACING_MS,
  MAX_PROBES,
  readLaunchReceipt,
  isLaunchReceiptPath,
  probeTimes,
  assertNativeIdentity,
  startupTopologyNotReady,
  runNativeQualification,
  isTransientNotReady,
  safeFailure,
  run,
};
