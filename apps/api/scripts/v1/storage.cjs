'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  STATE,
  load,
  native,
  statePath,
  hashFile,
  args,
  browserOrigins,
} = require('./config.cjs');
const { freePorts, listeners, capacity } = require('./preflight.cjs');

const RELEASE = '4.45';
const ARCHIVE_NAME = 'seaweedfs-4.45-darwin_arm64.tar.gz';
const PUBLISHED_ARCHIVE_NAME = 'darwin_arm64.tar.gz';
const ARCHIVE_SHA256 =
  'e38ed55f9b9d59d926befcba05088010454551677547835ba154dbc2a2d8d4a4';
const ARCHIVE_URL = `https://github.com/seaweedfs/seaweedfs/releases/download/${RELEASE}/${PUBLISHED_ARCHIVE_NAME}`;
const PORTS = Object.freeze([
  48331, 48332, 48333, 48334, 58331, 58332, 58333, 58334,
]);
const BINARY_SHA256 =
  '69a6681194b78e02f599f080f3ae26e80aef246bd2bf967666c71ce71fd8642c';
const COMMIT = '79b87202136cebdaaa7db4d94eaa5915ad381276';
const MAX_ARCHIVE_BYTES = 300 * 1024 ** 2;
const MAX_EXTRACTED_BYTES = 600 * 1024 ** 2;
const MAX_PRIVATE_STATE_BYTES = 3 * 1024 ** 3;
const GRPC_SOCKETS = Object.freeze([
  '/tmp/seaweedfs-master-grpc-58331.sock',
  '/tmp/seaweedfs-volume-grpc-58332.sock',
  '/tmp/seaweedfs-filer-grpc-58334.sock',
  '/tmp/seaweedfs-s3-grpc-58333.sock',
]);
const SYSTEM_CONFIG_DIRS = Object.freeze([
  '/usr/local/etc/seaweedfs',
  '/etc/seaweedfs',
]);
const ROOT_ENTRY_NAMES = Object.freeze([
  ARCHIVE_NAME,
  'bin',
  'data',
  'logs',
  'credentials',
  'installation.json',
  'data-server',
  'config-server',
  'home-server',
  'logs-server',
  's3-server-identities.json',
]);
const PROVIDER_CONFIG_NAMES = Object.freeze([
  '.seaweedfs',
  'security.toml',
  'filer.toml',
  'notification.toml',
  'replication.toml',
  's3.json',
  'iam.toml',
  'mq.toml',
]);

function fail(message) {
  throw new Error(`V1 storage refused: ${message}`);
}
function storagePaths() {
  const root = path.join(STATE, 'object-storage', `seaweedfs-${RELEASE}`);
  return Object.freeze({
    root,
    archive: path.join(root, ARCHIVE_NAME),
    bin: path.join(root, 'bin'),
    weed: path.join(root, 'bin', 'weed'),
    data: path.join(root, 'data'),
    logs: path.join(root, 'logs'),
    dataServer: path.join(root, 'data-server'),
    configServer: path.join(root, 'config-server'),
    homeServer: path.join(root, 'home-server'),
    logsServer: path.join(root, 'logs-server'),
    identities: path.join(root, 's3-server-identities.json'),
    filerServerSocket: path.join(STATE, 'filer-server.sock'),
    s3ServerSocket: path.join(STATE, 's3-server.sock'),
    filerSocket: path.join(STATE, 'filer.sock'),
    s3Socket: path.join(STATE, 's3.sock'),
    credentials: path.join(root, 'credentials'),
    installation: path.join(root, 'installation.json'),
    grpcSockets: GRPC_SOCKETS,
  });
}
function boundedSize(value, maximum, label) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum)
    fail(`${label} exceeds approved bound`);
  return value;
}
function lstat(target, label = 'path') {
  try {
    return fs.lstatSync(target);
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    fail(`${label} is inaccessible`);
  }
}
function directorySize(root) {
  const stat = lstat(root, 'storage path');
  if (!stat) return 0;
  if (stat.isSymbolicLink()) fail('storage path is indirect');
  if (!stat.isDirectory()) return stat.size;
  return fs
    .readdirSync(root, { withFileTypes: true })
    .reduce((total, entry) => {
      const target = path.join(root, entry.name);
      const child = lstat(target, 'storage path');
      if (!child || child.isSymbolicLink()) fail('storage path is indirect');
      return total + (child.isDirectory() ? directorySize(target) : child.size);
    }, 0);
}
function privateDirectory(target, { empty = false } = {}) {
  const stat = lstat(target, 'storage directory');
  if (!stat || stat.isSymbolicLink() || !stat.isDirectory())
    fail('storage directory is missing or indirect');
  if (stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o700)
    fail('storage directory is not private');
  if (empty && fs.readdirSync(target).length)
    fail('storage configuration is not empty');
  return target;
}
function privateFile(target) {
  const stat = lstat(target, 'storage file');
  if (!stat || stat.isSymbolicLink() || !stat.isFile())
    fail('storage identity file is missing or indirect');
  if (stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o600)
    fail('storage identity file is not private');
  return stat;
}
function safeArchivePath(value) {
  if (typeof value !== 'string' || !value || value.includes('\0')) return false;
  const normalized = value.replaceAll('\\', '/').replace(/^\.\//, '');
  return (
    Boolean(normalized) &&
    !normalized.startsWith('/') &&
    !normalized.split('/').some((part) => part === '..' || part === '')
  );
}
function validateArchiveListing(namesListing, verboseListing) {
  const names = String(namesListing).split(/\r?\n/).filter(Boolean);
  const modes = String(verboseListing)
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line[0]);
  if (!names.length || names.length !== modes.length)
    fail('archive listing is incomplete');
  if (modes.some((mode) => !['-', 'd'].includes(mode)))
    fail('archive contains link or special entry');
  if (names.some((name) => !safeArchivePath(name)))
    fail('archive contains unsafe path');
  const weeds = names.filter(
    (name, index) =>
      modes[index] === '-' && name.replace(/^\.\//, '') === 'weed',
  );
  if (weeds.length !== 1)
    fail('archive must contain exactly one root weed binary');
  return names.map((name, index) => ({ mode: modes[index], name }));
}
function verifyArchive(paths = storagePaths()) {
  statePath(paths.archive);
  const stat = lstat(paths.archive, 'archive');
  if (!stat || !stat.isFile() || stat.isSymbolicLink())
    fail('archive is not an owned regular file');
  boundedSize(stat.size, MAX_ARCHIVE_BYTES, 'archive');
  if (hashFile(paths.archive) !== ARCHIVE_SHA256)
    fail('archive checksum differs');
  const names = native('/usr/bin/tar', ['-tzf', paths.archive], {
    timeout: 10000,
  });
  const verbose = native('/usr/bin/tar', ['-tvzf', paths.archive], {
    timeout: 10000,
  });
  validateArchiveListing(names, verbose);
  return {
    archive: paths.archive,
    sha256: ARCHIVE_SHA256,
    source: ARCHIVE_URL,
  };
}
function installationProvenance(paths, binarySha256) {
  statePath(paths.installation);
  privateFile(paths.installation);
  let provenance;
  try {
    provenance = JSON.parse(fs.readFileSync(paths.installation, 'utf8'));
  } catch {
    fail('installation provenance is invalid');
  }
  if (
    !provenance ||
    typeof provenance !== 'object' ||
    Array.isArray(provenance) ||
    Object.keys(provenance).sort().join(',') !==
      'archiveSha256,binarySha256,release' ||
    provenance.release !== RELEASE ||
    provenance.archiveSha256 !== ARCHIVE_SHA256 ||
    provenance.binarySha256 !== binarySha256
  )
    fail('installation provenance differs');
  return provenance;
}
function validWeedVersion(version) {
  return new RegExp(
    `^version\\s+\\S+\\s+${RELEASE.replace('.', '\\.')}\\s+${COMMIT}\\s+darwin\\s+arm64\\s*$`,
    'i',
  ).test(version);
}
function verifyInstalled(paths = storagePaths()) {
  for (const target of [
    paths.root,
    paths.bin,
    paths.weed,
    paths.data,
    paths.installation,
  ])
    statePath(target);
  privateDirectory(paths.root);
  privateDirectory(paths.bin);
  boundedSize(
    directorySize(paths.bin),
    MAX_EXTRACTED_BYTES,
    'extracted binary',
  );
  const weed = lstat(paths.weed, 'weed binary');
  if (
    !weed ||
    !weed.isFile() ||
    weed.isSymbolicLink() ||
    (weed.mode & 0o111) === 0
  )
    fail('weed binary is not executable');
  const sha256 = hashFile(paths.weed);
  if (sha256 !== BINARY_SHA256) fail('weed binary checksum differs');
  const provenance = installationProvenance(paths, sha256);
  const version = native(paths.weed, ['version']).trim();
  if (!validWeedVersion(version)) fail('unexpected weed version');
  return {
    executable: fs.realpathSync(paths.weed),
    sha256,
    version,
    provenance,
  };
}
function assertConfig(c) {
  if (
    c.storageEndpoint !== 'http://127.0.0.1:48333' ||
    c.bucket !== 'isntgram-v1-media' ||
    c.webOrigin !== 'http://127.0.0.1:4320'
  )
    fail('storage configuration differs');
  const origins = browserOrigins(c);
  if (origins.length < 1 || origins.length > 2 || origins[0] !== c.webOrigin)
    fail('storage browser origins differ');
  return origins;
}
function validateStoredCredentials(c, stored) {
  if (
    !stored ||
    typeof stored !== 'object' ||
    Array.isArray(stored) ||
    Object.keys(stored).sort().join(',') !==
      'AWS_ACCESS_KEY_ID,AWS_SECRET_ACCESS_KEY' ||
    stored.AWS_ACCESS_KEY_ID !== c?.secrets?.S3_ACCESS_KEY_ID ||
    stored.AWS_SECRET_ACCESS_KEY !== c?.secrets?.S3_SECRET_ACCESS_KEY
  )
    fail('stored credentials differ');
  return stored;
}
function credentialsFromPrivateFile(c, paths = storagePaths()) {
  statePath(paths.credentials);
  privateFile(paths.credentials);
  let stored;
  try {
    stored = JSON.parse(fs.readFileSync(paths.credentials, 'utf8'));
  } catch {
    fail('stored credentials are invalid');
  }
  return validateStoredCredentials(c, stored);
}
function staticIdentity(c, paths) {
  const stored = paths ? credentialsFromPrivateFile(c, paths) : c?.secrets;
  const accessKey = stored?.S3_ACCESS_KEY_ID || stored?.AWS_ACCESS_KEY_ID;
  const secretKey =
    stored?.S3_SECRET_ACCESS_KEY || stored?.AWS_SECRET_ACCESS_KEY;
  if (
    !/^[A-Za-z0-9_-]{32,100}$/.test(accessKey || '') ||
    !/^[A-Za-z0-9_-]{32,100}$/.test(secretKey || '')
  )
    fail('storage credentials differ');
  return {
    identities: [
      {
        name: 'isntgram-v1-local-admin',
        credentials: [{ accessKey, secretKey }],
        actions: ['Admin', 'Read', 'Write', 'List', 'Tagging'],
      },
    ],
  };
}
function identityText(c, paths) {
  return JSON.stringify(staticIdentity(c, paths), null, 2) + '\n';
}
function assertExactFile(target, expected) {
  privateFile(target);
  if (fs.readFileSync(target, 'utf8') !== expected)
    fail('storage identity differs');
}
function assertAbsent(target, label = 'socket') {
  if (lstat(target, label)) fail(`${label} already exists`);
}
function assertRootEntries(paths = storagePaths()) {
  privateDirectory(paths.root);
  const unexpected = fs
    .readdirSync(paths.root)
    .filter((name) => !ROOT_ENTRY_NAMES.includes(name));
  if (unexpected.length) fail('storage root has unexpected entry');
  return ROOT_ENTRY_NAMES;
}
function serverDirectories(paths) {
  return [
    paths.dataServer,
    paths.configServer,
    paths.homeServer,
    paths.logsServer,
  ];
}
function prepareServer(c, paths = storagePaths()) {
  assertConfig(c);
  verifyInstalled(paths);
  assertResourceBudget(paths);
  statePath(paths.root);
  for (const target of [...serverDirectories(paths), paths.identities])
    statePath(target);
  assertRootEntries(paths);
  const expected = identityText(c, paths);
  const dirs = serverDirectories(paths);
  const present = dirs.map((target) =>
    Boolean(lstat(target, 'storage directory')),
  );
  const identityPresent = Boolean(
    lstat(paths.identities, 'storage identity file'),
  );
  if (present.some(Boolean) || identityPresent) {
    if (!present.every(Boolean) || !identityPresent)
      fail('server storage preparation is partial');
    for (const target of dirs)
      privateDirectory(target, {
        empty: target === paths.configServer || target === paths.homeServer,
      });
    assertExactFile(paths.identities, expected);
    return { created: false, paths };
  }
  for (const target of dirs) fs.mkdirSync(target, { mode: 0o700 });
  try {
    fs.writeFileSync(paths.identities, expected, { mode: 0o600, flag: 'wx' });
  } catch (error) {
    fail(`server identity creation failed: ${error.code || 'unknown'}`);
  }
  for (const target of dirs)
    privateDirectory(target, {
      empty: target === paths.configServer || target === paths.homeServer,
    });
  assertExactFile(paths.identities, expected);
  return { created: true, paths };
}
function serverArgs(c, paths = storagePaths()) {
  const origins = assertConfig(c);
  return [
    `-config_dir=${paths.configServer}`,
    `-logdir=${paths.logsServer}`,
    'server',
    '-ip=127.0.0.1',
    '-ip.bind=127.0.0.1',
    `-dir=${paths.dataServer}`,
    `-master.dir=${paths.dataServer}`,
    '-master=true',
    '-volume=true',
    '-filer=true',
    '-s3=true',
    '-webdav=false',
    '-sftp=false',
    '-iam=false',
    '-s3.iam=false',
    '-mq.broker=false',
    '-mq.agent=false',
    '-debug=false',
    '-master.port=48331',
    '-master.port.grpc=58331',
    '-volume.port=48332',
    '-volume.port.grpc=58332',
    '-filer.port=48334',
    '-filer.port.grpc=58334',
    '-s3.port=48333',
    '-s3.port.grpc=58333',
    '-s3.ip.bind=127.0.0.1',
    '-master.volumeSizeLimitMB=64',
    '-volume.fileSizeLimitMB=5',
    '-s3.port.iceberg=0',
    '-s3.port.lance=0',
    '-metricsPort=0',
    '-master.telemetry=false',
    '-s3.autoCreateBucket=false',
    `-s3.allowedOrigins=${origins.join(',')}`,
    `-filer.allowedOrigins=${origins.join(',')}`,
    `-s3.config=${paths.identities}`,
    '-s3.concurrentFileUploadLimit=1',
    '-s3.concurrentUploadLimitMB=5',
    '-filer.concurrentFileUploadLimit=1',
    '-filer.concurrentUploadLimitMB=5',
    `-filer.localSocket=${paths.filerServerSocket}`,
    `-s3.localSocket=${paths.s3ServerSocket}`,
  ];
}
function assertServerConfiguration(paths = storagePaths()) {
  assertRootEntries(paths);
  privateDirectory(paths.configServer, { empty: true });
  privateDirectory(paths.homeServer, { empty: true });
  for (const fallback of SYSTEM_CONFIG_DIRS) {
    const stat = lstat(fallback, 'system provider configuration');
    if (stat) fail('system provider configuration exists');
  }
}
function resourceBounds() {
  return Object.freeze({
    archiveBytes: MAX_ARCHIVE_BYTES,
    extractedBytes: MAX_EXTRACTED_BYTES,
    privateStateBytes: MAX_PRIVATE_STATE_BYTES,
    freeDiskBytes: 5 * 1024 ** 3,
  });
}
function privateStateKiB(execute = native) {
  statePath(STATE);
  privateDirectory(STATE);
  const output = execute('/usr/bin/du', ['-sk', STATE]).trim();
  const match = output.match(/^(\d+)\s+/);
  const kib = Number(match?.[1]);
  if (!Number.isSafeInteger(kib) || kib < 0)
    fail('private state size is invalid');
  return kib;
}
function assertResourceBudget(paths = storagePaths(), execute = native) {
  capacity();
  const bytes = privateStateKiB(execute) * 1024;
  if (bytes > MAX_PRIVATE_STATE_BYTES)
    fail('private v1 state exceeds approved bound');
  return { bytes, limit: MAX_PRIVATE_STATE_BYTES, root: paths.root };
}
function assertSocketPathLimits(paths = storagePaths()) {
  const sockets = [
    paths.filerServerSocket,
    paths.s3ServerSocket,
    ...paths.grpcSockets,
  ];
  if (
    sockets.length !== 6 ||
    sockets.some((target) => Buffer.byteLength(target) >= 104)
  )
    fail('storage socket paths exceed the native limit');
  return sockets;
}
function assertResources(paths = storagePaths(), execute = native) {
  const budget = assertResourceBudget(paths, execute);
  privateDirectory(paths.dataServer);
  privateDirectory(paths.logsServer);
  return budget;
}
function launchPreflight(c, paths = storagePaths(), execute = native) {
  assertConfig(c);
  verifyInstalled(paths);
  assertRootEntries(paths);
  for (const target of serverDirectories(paths))
    privateDirectory(target, {
      empty: target === paths.configServer || target === paths.homeServer,
    });
  assertExactFile(paths.identities, identityText(c, paths));
  assertServerConfiguration(paths);
  assertResources(paths, execute);
  for (const target of assertSocketPathLimits(paths)) assertAbsent(target);
  freePorts(PORTS, execute);
  return { ports: PORTS, args: serverArgs(c, paths), paths };
}
function loopbackListener(port, pid, execute = native) {
  const output = execute('/usr/sbin/lsof', [
    '-nP',
    '-a',
    '-p',
    String(pid),
    `-iTCP:${port}`,
    '-sTCP:LISTEN',
    '-Fn',
  ]);
  const addresses = output
    .split('\n')
    .filter((line) => line.startsWith('n'))
    .map((line) => line.slice(1));
  if (addresses.length !== 1 || addresses[0] !== `127.0.0.1:${port}`)
    fail(`storage listener ${port} is not loopback`);
  return addresses[0];
}
function allListeners(pid, execute = native) {
  const output = execute('/usr/sbin/lsof', [
    '-nP',
    '-a',
    '-p',
    String(pid),
    '-iTCP',
    '-sTCP:LISTEN',
    '-Fn',
  ]);
  const addresses = output
    .split('\n')
    .filter((line) => line.startsWith('n'))
    .map((line) => line.slice(1))
    .sort();
  const expected = PORTS.map((port) => `127.0.0.1:${port}`).sort();
  if (JSON.stringify(addresses) !== JSON.stringify(expected))
    fail(
      'complete storage listener inventory differs from the approved loopback ports',
    );
  return addresses;
}
function socketPathFromLsof(value) {
  const pathname = String(value).split('->', 1)[0].trim();
  return pathname.startsWith('/') ? pathname : null;
}
function assertSocketNames(listed, expected) {
  const filesystemPaths = new Set(
    listed.map(socketPathFromLsof).filter((pathname) => pathname !== null),
  );
  const required = new Set(expected);
  if (
    filesystemPaths.size !== required.size ||
    [...required].some((pathname) => !filesystemPaths.has(pathname))
  )
    fail('complete storage socket inventory differs');
  return [...required].sort();
}
function assertSocketInventory(pid, paths = storagePaths(), execute = native) {
  const expected = assertSocketPathLimits(paths);
  const output = execute('/usr/sbin/lsof', [
    '-nP',
    '-a',
    '-p',
    String(pid),
    '-U',
    '-Fn',
  ]);
  const listed = output
    .split('\n')
    .filter((line) => line.startsWith('n'))
    .map((line) => line.slice(1));
  const sockets = assertSocketNames(listed, expected);
  for (const target of sockets) {
    const stat = lstat(target, 'storage socket');
    if (
      !stat ||
      stat.isSymbolicLink() ||
      !stat.isSocket() ||
      stat.uid !== process.getuid() ||
      (stat.mode & 0o077) !== 0
    )
      fail('storage socket ownership or mode differs');
  }
  return sockets;
}
function inspectOwnedProcess(c, pid, paths = storagePaths(), execute = native) {
  assertConfig(c);
  if (!Number.isSafeInteger(pid) || pid < 2) fail('storage pid differs');
  const installed = verifyInstalled(paths);
  const uid = execute('/bin/ps', ['-p', String(pid), '-o', 'uid=']).trim();
  if (uid !== String(process.getuid()))
    fail('storage process owner differs');
  const text = execute('/usr/sbin/lsof', [
    '-a',
    '-p',
    String(pid),
    '-d',
    'txt',
    '-Fn',
  ]);
  const cwd = execute('/usr/sbin/lsof', [
    '-a',
    '-p',
    String(pid),
    '-d',
    'cwd',
    '-Fn',
  ]);
  if (
    !text.split('\n').includes(`n${installed.executable}`) ||
    !cwd.split('\n').includes(`n${paths.root}`)
  )
    fail('storage process identity differs');
  return {
    pid,
    executable: installed.executable,
    cwd: paths.root,
    uid: Number(uid),
    started: execute('/bin/ps', ['-p', String(pid), '-o', 'lstart=']).trim(),
  };
}
function assertNativeServerArgs(c, pid, paths = storagePaths(), execute = native) {
  if (!Number.isSafeInteger(pid) || pid < 2) fail('storage pid differs');
  const expected = [paths.weed, ...serverArgs(c, paths)].join(' ');
  const actual = execute('/bin/ps', [
    '-ww',
    '-p',
    String(pid),
    '-o',
    'command=',
  ]).trim();
  if (actual !== expected) fail('storage process arguments differ');
  return actual;
}
function completeQualification(c, paths = storagePaths(), execute = native) {
  assertConfig(c);
  verifyInstalled(paths);
  assertRootEntries(paths);
  for (const target of serverDirectories(paths))
    privateDirectory(target, {
      empty: target === paths.configServer || target === paths.homeServer,
    });
  assertExactFile(paths.identities, identityText(c, paths));
  assertServerConfiguration(paths);
  assertResources(paths, execute);
  assertSocketPathLimits(paths);
  const pids = PORTS.map((port) => listeners(port, execute));
  if (pids.some((ids) => ids.length !== 1))
    fail('expected one listener per storage port');
  const pid = pids[0][0];
  if (pids.some((ids) => ids[0] !== pid))
    fail('storage listeners have different owners');
  const identity = inspectOwnedProcess(c, pid, paths, execute);
  const command = assertNativeServerArgs(c, pid, paths, execute);
  const addresses = PORTS.map((port) => loopbackListener(port, pid, execute));
  allListeners(pid, execute);
  const sockets = assertSocketInventory(pid, paths, execute);
  return { ...identity, command, ports: PORTS, addresses, sockets };
}
function inspect(mode) {
  if (!['bootstrap', 'prepare', 'running'].includes(mode))
    fail('unexpected mode');
  const c = load();
  if (mode === 'running') return completeQualification(c);
  const preparation = prepareServer(c);
  return { preparation, preflight: launchPreflight(c) };
}
if (require.main === module)
  try {
    console.log(JSON.stringify(inspect(args(1)[0])));
  } catch {
    console.error(
      'V1 storage guard refused; inspect owned paths and native identity. No mutation attempted.',
    );
    process.exitCode = 1;
  }

module.exports = {
  RELEASE,
  COMMIT,
  BINARY_SHA256,
  ARCHIVE_NAME,
  PUBLISHED_ARCHIVE_NAME,
  ARCHIVE_SHA256,
  ARCHIVE_URL,
  PORTS,
  MAX_ARCHIVE_BYTES,
  MAX_EXTRACTED_BYTES,
  MAX_PRIVATE_STATE_BYTES,
  GRPC_SOCKETS,
  SYSTEM_CONFIG_DIRS,
  PROVIDER_CONFIG_NAMES,
  ROOT_ENTRY_NAMES,
  boundedSize,
  directorySize,
  storagePaths,
  safeArchivePath,
  validateArchiveListing,
  verifyArchive,
  verifyInstalled,
  installationProvenance,
  validWeedVersion,
  validateStoredCredentials,
  credentialsFromPrivateFile,
  staticIdentity,
  identityText,
  assertRootEntries,
  prepareServer,
  serverArgs,
  assertAbsent,
  assertServerConfiguration,
  resourceBounds,
  privateStateKiB,
  assertResourceBudget,
  assertSocketPathLimits,
  assertResources,
  launchPreflight,
  loopbackListener,
  allListeners,
  socketPathFromLsof,
  assertSocketNames,
  assertSocketInventory,
  inspectOwnedProcess,
  assertNativeServerArgs,
  completeQualification,
  inspect,
};
