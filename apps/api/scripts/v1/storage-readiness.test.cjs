'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const config = require('./config.cjs');
const {
  WINDOW_MS,
  PROBE_SPACING_MS,
  MAX_PROBES,
  isLaunchReceiptPath,
  probeTimes,
  assertNativeIdentity,
  startupTopologyNotReady,
  runNativeQualification,
  isTransientNotReady,
  safeFailure,
  run,
} = require('./storage-readiness.cjs');

test('readiness scheduling is fixed at six probes across the sixty-second launch window', () => {
  assert.deepEqual(
    probeTimes(1_000),
    [1000, 11000, 21000, 31000, 41000, 51000],
  );
  assert.equal(MAX_PROBES, 6);
  assert.equal(PROBE_SPACING_MS, 10_000);
  assert.equal(WINDOW_MS, 60_000);
});

test('native qualification must retain exact launch process identity', () => {
  const launch = { pid: 42, executable: '/private/weed', started: 'start' };
  assert.doesNotThrow(() => assertNativeIdentity({ ...launch }, launch));
  assert.throws(
    () => assertNativeIdentity({ ...launch, pid: 43 }, launch),
    /identity differs/,
  );
});

test('launch receipts are accepted only from the owned UUID evidence path', () => {
  const name = 'storage-launch-123e4567-e89b-12d3-a456-426614174000.json';
  assert.equal(
    isLaunchReceiptPath(path.join(config.STATE, 'evidence', name)),
    true,
  );
  assert.equal(
    isLaunchReceiptPath(path.join(config.STATE, 'evidence', 'other.json')),
    false,
  );
  assert.equal(
    isLaunchReceiptPath(
      '/private/storage-launch-123e4567-e89b-12d3-a456-426614174000.json',
    ),
    false,
  );
});

test('safe readiness failures omit raw messages and URLs', () => {
  const error = Object.assign(
    new Error('http://signed.example.invalid/?secret'),
    {
      code: 'AccessDenied',
      $metadata: { httpStatusCode: 403 },
    },
  );
  assert.deepEqual(safeFailure(error), {
    name: 'Error',
    code: 'AccessDenied',
    httpStatus: 403,
  });
});

test('native readiness launches the configured node executable, never its directory', () => {
  let invocation;
  const output = runNativeQualification(
    { nodeBin: '/private/node-bin' },
    5_000,
    (command, args, options) => {
      invocation = { command, args, options };
      return '{"pid":42}';
    },
  );
  assert.equal(invocation.command, '/private/node-bin/node');
  assert.deepEqual(invocation.args, [
    require('node:path').join(__dirname, 'storage.cjs'),
    'running',
  ]);
  assert.equal(invocation.options.timeout, 5_000);
  assert.deepEqual(output, { pid: 42 });
  assert.equal(isTransientNotReady({ code: 'ECONNREFUSED' }), true);
  assert.equal(isTransientNotReady(new Error('identity differs')), false);
});

test('injected readiness run passes after its first fully verified read-only probe', async () => {
  let now = 100_000;
  let heads = 0;
  let destroyed = false;
  const writes = [];
  const launch = {
    atMs: now,
    sha256: 'a'.repeat(64),
    pid: 42,
    executable: '/private/weed',
    started: 'native start',
  };
  class HeadBucket {
    constructor(input) {
      this.input = input;
    }
  }
  const output = await run('/private/launch.json', {
    now: () => now,
    sleep: async (ms) => {
      now += ms;
    },
    load: () => ({ bucket: 'isntgram-v1-media' }),
    paths: () => ({}),
    readLaunch: () => launch,
    receiptPath: () => '/private/readiness.json',
    writeReceipt: (_file, value) => writes.push(value),
    nativeQualification: () => ({
      pid: launch.pid,
      executable: launch.executable,
      started: launch.started,
    }),
    createClient: () => ({
      send: async (command) => {
        assert.ok(command instanceof HeadBucket);
        assert.equal(command.input.Bucket, 'isntgram-v1-media');
        heads += 1;
      },
      destroy: () => {
        destroyed = true;
      },
    }),
    HeadBucketCommand: HeadBucket,
  });
  assert.equal(heads, 1);
  assert.equal(destroyed, true);
  assert.equal(output.result.probes.length, 1);
  assert.equal(output.result.passedElapsedMs, 0);
  assert.deepEqual(
    writes.map((value) => value.stage),
    ['allocated', 'passed'],
  );
});

test('a late HeadBucket result never produces a passed readiness receipt', async () => {
  let now = 100_000;
  const writes = [];
  let destroyed = false;
  const launch = {
    atMs: now,
    sha256: 'a'.repeat(64),
    pid: 42,
    executable: '/private/weed',
    started: 'native start',
  };
  class HeadBucket {}
  await assert.rejects(
    run('/private/launch.json', {
      now: () => now,
      sleep: async (ms) => {
        now += ms;
      },
      load: () => ({ bucket: 'isntgram-v1-media' }),
      paths: () => ({}),
      readLaunch: () => launch,
      receiptPath: () => '/private/readiness.json',
      writeReceipt: (_file, value) => writes.push(value),
      nativeQualification: () => ({
        pid: launch.pid,
        executable: launch.executable,
        started: launch.started,
      }),
      createClient: () => ({
        send: async () => {
          now = launch.atMs + WINDOW_MS + 1;
        },
        destroy: () => {
          destroyed = true;
        },
      }),
      HeadBucketCommand: HeadBucket,
    }),
    /deadline reached/,
  );
  assert.equal(destroyed, true);
  assert.equal(writes.at(-1).stage, 'failed');
});

test('wrong native identity is a hard failure and never retries HeadBucket', async () => {
  let heads = 0;
  const launch = {
    atMs: 100_000,
    sha256: 'a'.repeat(64),
    pid: 42,
    executable: '/private/weed',
    started: 'native start',
  };
  class HeadBucket {}
  await assert.rejects(
    run('/private/launch.json', {
      now: () => launch.atMs,
      load: () => ({ bucket: 'isntgram-v1-media' }),
      paths: () => ({}),
      readLaunch: () => launch,
      receiptPath: () => '/private/readiness.json',
      writeReceipt: () => {},
      nativeQualification: () => ({ ...launch, pid: 43 }),
      createClient: () => ({
        send: async () => (heads += 1),
        destroy: () => {},
      }),
      HeadBucketCommand: HeadBucket,
    }),
    /identity differs/,
  );
  assert.equal(heads, 0);
});

test('only a strictly owned process with a missing expected listener is startup-not-ready', () => {
  const launch = { pid: 42, executable: '/private/weed', started: 'native start' };
  const calls = [];
  const result = startupTopologyNotReady({}, launch, {}, {
    inspectOwnedProcess: () => ({ ...launch }),
    assertNativeServerArgs: () => calls.push('argv'),
    listeners: (port) => (port === 48331 ? [] : [42]),
    socketPaths: () => [],
    native: () => '',
  });
  assert.equal(result, true);
  assert.deepEqual(calls, ['argv']);
  assert.equal(isTransientNotReady({ code: 'STORAGE_STARTUP_NOT_READY' }), true);
});

test('extra listener ownership or failed strict identity remains fatal', () => {
  const launch = { pid: 42, executable: '/private/weed', started: 'native start' };
  assert.equal(
    startupTopologyNotReady({}, launch, {}, {
      inspectOwnedProcess: () => ({ ...launch }),
      assertNativeServerArgs: () => {},
      listeners: (port) => (port === 48331 ? [42, 99] : [42]),
    }),
    false,
  );
  assert.throws(
    () => startupTopologyNotReady({}, launch, {}, {
      inspectOwnedProcess: () => ({ ...launch, pid: 99 }),
      assertNativeServerArgs: () => assert.fail('must not inspect arguments'),
      listeners: () => [],
    }),
    /identity differs/,
  );
  assert.equal(
    startupTopologyNotReady({}, launch, {}, {
      inspectOwnedProcess: () => ({ ...launch }),
      assertNativeServerArgs: () => {},
      listeners: (port) =>
        port === 48331 ? [] : port === 48332 ? [42, 99] : [42],
      socketPaths: () => [],
      native: () => '',
    }),
    false,
  );
});

test('a missing port cannot mask foreign or unsafe sockets', () => {
  const launch = { pid: 42, executable: '/private/weed', started: 'native start' };
  const common = {
    inspectOwnedProcess: () => ({ ...launch }),
    assertNativeServerArgs: () => {},
    listeners: (port) => (port === 48331 ? [] : [42]),
    socketPaths: () => ['/private/one.sock', '/private/two.sock'],
  };
  assert.equal(
    startupTopologyNotReady({}, launch, {}, {
      ...common,
      native: () => 'n/private/one.sock\nn/private/foreign.sock\n',
    }),
    false,
  );
  assert.equal(
    startupTopologyNotReady({}, launch, {}, {
      ...common,
      native: () => 'n/private/one.sock\nn/private/two.sock\n',
      lstat: (socket) => ({
        isSocket: () => true,
        uid: process.getuid(),
        mode: socket.endsWith('two.sock') ? 0o777 : 0o700,
      }),
    }),
    false,
  );
});

test('readiness retries a guarded incomplete topology but not an unexpected topology', async () => {
  let now = 100_000;
  let attempts = 0;
  const launch = {
    atMs: now,
    sha256: 'a'.repeat(64),
    pid: 42,
    executable: '/private/weed',
    started: 'native start',
  };
  class HeadBucket {}
  const output = await run('/private/launch.json', {
    now: () => now,
    sleep: async (ms) => { now += ms; },
    load: () => ({ bucket: 'isntgram-v1-media' }),
    paths: () => ({}),
    readLaunch: () => launch,
    receiptPath: () => '/private/readiness.json',
    writeReceipt: () => {},
    nativeQualification: () => {
      attempts += 1;
      if (attempts === 1) throw new Error('incomplete native topology');
      return { pid: launch.pid, executable: launch.executable, started: launch.started };
    },
    startupTopologyNotReady: () => attempts === 1,
    createClient: () => ({ send: async () => {}, destroy: () => {} }),
    HeadBucketCommand: HeadBucket,
  });
  assert.equal(attempts, 2);
  assert.equal(output.result.probes[0].failure.code, 'STORAGE_STARTUP_NOT_READY');
});
