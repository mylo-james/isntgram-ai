'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  PORTS,
  GRPC_SOCKETS,
  BINARY_SHA256,
  COMMIT,
  MAX_ARCHIVE_BYTES,
  MAX_EXTRACTED_BYTES,
  MAX_PRIVATE_STATE_BYTES,
  boundedSize,
  safeArchivePath,
  validateArchiveListing,
  validWeedVersion,
  staticIdentity,
  validateStoredCredentials,
  assertSocketPathLimits,
  ROOT_ENTRY_NAMES,
  assertRootEntries,
  assertSocketNames,
  assertNativeServerArgs,
  serverArgs,
  resourceBounds,
  loopbackListener,
  allListeners,
  assertAbsent,
} = require('./storage.cjs');

const config = Object.freeze({
  storageEndpoint: 'http://127.0.0.1:48333',
  bucket: 'isntgram-v1-media',
  webOrigin: 'http://127.0.0.1:4320',
  secrets: {
    S3_ACCESS_KEY_ID: 'a'.repeat(32),
    S3_SECRET_ACCESS_KEY: 'b'.repeat(32),
  },
});
const paths = Object.freeze({
  weed: '/private/state/bin/weed',
  root: '/private/state',
  configServer: '/private/state/config-server',
  logsServer: '/private/state/logs-server',
  dataServer: '/private/state/data-server',
  identities: '/private/state/s3-server-identities.json',
  filerServerSocket: '/private/state/filer-server.sock',
  s3ServerSocket: '/private/state/s3-server.sock',
});

function expectedNativeCommand(c = config) {
  return [paths.weed, ...serverArgs(c, paths)].join(' ');
}

function psCommand(command) {
  return (executable, args) => {
    assert.equal(executable, '/bin/ps');
    assert.deepEqual(args, ['-ww', '-p', '42', '-o', 'command=']);
    return `${command}\n`;
  };
}

test('resource bounds retain the approved archive, extraction, state and free-space limits', () => {
  assert.deepEqual(resourceBounds(), {
    archiveBytes: 300 * 1024 ** 2,
    extractedBytes: 600 * 1024 ** 2,
    privateStateBytes: 3 * 1024 ** 3,
    freeDiskBytes: 5 * 1024 ** 3,
  });
  assert.equal(
    boundedSize(MAX_ARCHIVE_BYTES, MAX_ARCHIVE_BYTES, 'archive'),
    MAX_ARCHIVE_BYTES,
  );
  assert.equal(
    boundedSize(MAX_EXTRACTED_BYTES, MAX_EXTRACTED_BYTES, 'extracted'),
    MAX_EXTRACTED_BYTES,
  );
  assert.throws(
    () =>
      boundedSize(
        MAX_PRIVATE_STATE_BYTES + 1,
        MAX_PRIVATE_STATE_BYTES,
        'state',
      ),
    /approved bound/,
  );
});

test('server arguments are the exact approved server mode without credentials or mini flags', () => {
  const command = serverArgs(config, paths);
  assert.equal(command[0], `-config_dir=${paths.configServer}`);
  assert.equal(command[2], 'server');
  assert.equal(command.includes('mini'), false);
  for (const port of PORTS)
    assert.ok(command.some((item) => item.endsWith(`=${port}`)));
  for (const expected of [
    '-ip=127.0.0.1',
    '-ip.bind=127.0.0.1',
    '-s3.ip.bind=127.0.0.1',
    '-webdav=false',
    '-sftp=false',
    '-iam=false',
    '-s3.iam=false',
    '-mq.broker=false',
    '-mq.agent=false',
    '-debug=false',
    '-metricsPort=0',
    '-s3.autoCreateBucket=false',
    '-s3.concurrentFileUploadLimit=1',
    '-s3.concurrentUploadLimitMB=5',
    '-filer.concurrentFileUploadLimit=1',
    '-filer.concurrentUploadLimitMB=5',
    '-s3.port.iceberg=0',
    '-s3.port.lance=0',
  ])
    assert.ok(command.includes(expected), expected);
  assert.equal(
    command.some((item) => /access|secret|credential/i.test(item)),
    false,
  );
  assert.equal(command.includes('-s3.metricsPort=0'), false);
  assert.ok(command.includes('-s3.allowedOrigins=http://127.0.0.1:4320'));
  assert.ok(command.includes('-filer.allowedOrigins=http://127.0.0.1:4320'));
});

test('phone view adds only its validated web origin to both browser CORS flags', () => {
  const phone = {
    webOrigin: 'https://isntgram-phone.example.ts.net:8445',
    s3Origin: 'https://isntgram-phone.example.ts.net:8446',
    serveWebPort: 8445,
    serveS3Port: 8446,
  };
  const command = serverArgs({ ...config, phoneView: phone }, paths);
  const origins = 'http://127.0.0.1:4320,https://isntgram-phone.example.ts.net:8445';
  assert.ok(command.includes(`-s3.allowedOrigins=${origins}`));
  assert.ok(command.includes(`-filer.allowedOrigins=${origins}`));
  assert.throws(
    () => serverArgs({ ...config, phoneView: { ...phone, extraOrigin: 'https://foreign.test' } }, paths),
    /phone view fields/,
  );
});

test('native qualification requires the exact launched command, including current CORS arguments', () => {
  assert.equal(
    assertNativeServerArgs(config, 42, paths, psCommand(expectedNativeCommand())),
    expectedNativeCommand(),
  );
  const phone = {
    webOrigin: 'https://isntgram-phone.example.ts.net:8445',
    s3Origin: 'https://isntgram-phone.example.ts.net:8446',
    serveWebPort: 8445,
    serveS3Port: 8446,
  };
  const expectedPhone = expectedNativeCommand({ ...config, phoneView: phone });
  assert.equal(
    assertNativeServerArgs({ ...config, phoneView: phone }, 42, paths, psCommand(expectedPhone)),
    expectedPhone,
  );
  assert.throws(
    () => assertNativeServerArgs({ ...config, phoneView: phone }, 42, paths, psCommand(expectedNativeCommand())),
    /arguments differ/,
  );
  assert.throws(
    () => assertNativeServerArgs(config, 42, paths, psCommand(`${expectedNativeCommand()} -debug=true`)),
    /arguments differ/,
  );
});

test('static identity has one named local admin and no anonymous credential', () => {
  const identity = staticIdentity(config);
  assert.deepEqual(identity.identities[0].actions, [
    'Admin',
    'Read',
    'Write',
    'List',
    'Tagging',
  ]);
  assert.equal(identity.identities.length, 1);
  assert.equal(identity.identities[0].credentials.length, 1);
  assert.throws(
    () => staticIdentity({ ...config, secrets: {} }),
    /credentials differ/,
  );
});

test('retained credential values must exactly match guarded configuration before identity derivation', () => {
  assert.deepEqual(
    validateStoredCredentials(config, {
      AWS_ACCESS_KEY_ID: config.secrets.S3_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: config.secrets.S3_SECRET_ACCESS_KEY,
    }),
    {
      AWS_ACCESS_KEY_ID: config.secrets.S3_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: config.secrets.S3_SECRET_ACCESS_KEY,
    },
  );
  assert.throws(
    () =>
      validateStoredCredentials(config, {
        AWS_ACCESS_KEY_ID: config.secrets.S3_ACCESS_KEY_ID,
        AWS_SECRET_ACCESS_KEY: 'other',
      }),
    /stored credentials differ/,
  );
});

test('six allowed Unix socket paths remain below the Darwin pathname limit', () => {
  assert.equal(
    assertSocketPathLimits({ ...paths, grpcSockets: GRPC_SOCKETS }).length,
    6,
  );
  assert.throws(
    () =>
      assertSocketPathLimits({
        ...paths,
        grpcSockets: Array(4).fill(`/tmp/${'x'.repeat(100)}.sock`),
      }),
    /native limit/,
  );
});

test('storage root uses an exact entry allowlist and rejects an unrecognized provider file', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'isntgram-storage-root-'));
  try {
    for (const name of ROOT_ENTRY_NAMES)
      fs.writeFileSync(path.join(root, name), 'x');
    fs.chmodSync(root, 0o700);
    assert.deepEqual(assertRootEntries({ root }), ROOT_ENTRY_NAMES);
    fs.writeFileSync(path.join(root, 'master.toml'), 'unexpected');
    assert.throws(() => assertRootEntries({ root }), /unexpected entry/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Unix inventory deduplicates approved repeated paths and refuses all other filesystem paths', () => {
  const expected = ['/tmp/a.sock', '/tmp/b.sock'];
  assert.deepEqual(
    assertSocketNames(
      ['/tmp/a.sock', '/tmp/a.sock', '/tmp/b.sock->/peer', '0x123'],
      expected,
    ),
    expected,
  );
  for (const listed of [
    ['/tmp/a.sock'],
    ['/tmp/a.sock', '/tmp/b.sock', '/tmp/extra'],
    ['/tmp/a.sock', '/tmp/malicious.fifo'],
  ])
    assert.throws(
      () => assertSocketNames(listed, expected),
      /complete storage socket inventory/,
    );
});

test('archive validation rejects traversal and provider links', () => {
  for (const value of ['../weed', '/weed', 'bin//weed', 'bin/../weed', ''])
    assert.equal(safeArchivePath(value), false);
  assert.equal(safeArchivePath('./weed'), true);
  assert.throws(
    () =>
      validateArchiveListing(
        'weed\n',
        'lrwxr-xr-x owner group 1 Jan 1 weed -> elsewhere\n',
      ),
    /link or special entry/,
  );
});

test('version parser accepts only the acquired Darwin arm64 4.45 binary identity', () => {
  assert.equal(
    BINARY_SHA256,
    '69a6681194b78e02f599f080f3ae26e80aef246bd2bf967666c71ce71fd8642c',
  );
  assert.equal(COMMIT, '79b87202136cebdaaa7db4d94eaa5915ad381276');
  assert.equal(
    validWeedVersion(`version 30GB 4.45 ${COMMIT} darwin arm64`),
    true,
  );
  for (const value of [
    `version 30GB 4.450 ${COMMIT} darwin arm64`,
    `version 30GB 4.46 ${COMMIT} darwin arm64`,
    'version 30GB 4.45 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa darwin arm64',
    `version 30GB 4.45 ${COMMIT} darwin amd64`,
  ])
    assert.equal(validWeedVersion(value), false);
});

test('all TCP listeners are one exact IPv4 loopback inventory', () => {
  const output = (items) =>
    `p42\n${items.map((item) => `n${item}`).join('\n')}\n`;
  assert.equal(
    loopbackListener(48331, 42, () => output(['127.0.0.1:48331'])),
    '127.0.0.1:48331',
  );
  assert.equal(
    allListeners(42, () => output(PORTS.map((port) => `127.0.0.1:${port}`)))
      .length,
    8,
  );
  for (const items of [['*:48331'], ['[::1]:48331'], ['0.0.0.0:48331']])
    assert.throws(
      () => loopbackListener(48331, 42, () => output(items)),
      /not loopback/,
    );
  assert.throws(
    () =>
      allListeners(42, () =>
        output([...PORTS.map((port) => `127.0.0.1:${port}`), '*:23646']),
      ),
    /complete storage listener inventory/,
  );
});

test('prelaunch socket guard refuses regular entries and dangling symlinks without removing them', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'isntgram-storage-test-'));
  try {
    const regular = path.join(root, 'regular.sock');
    fs.writeFileSync(regular, 'not a socket');
    assert.throws(() => assertAbsent(regular), /already exists/);
    const dangling = path.join(root, 'dangling.sock');
    fs.symlinkSync(path.join(root, 'missing'), dangling);
    assert.throws(() => assertAbsent(dangling), /already exists/);
    assert.equal(GRPC_SOCKETS.length, 4);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
