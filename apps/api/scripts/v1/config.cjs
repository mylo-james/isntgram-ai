'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { isIP } = require('node:net');

const ROOT = path.resolve(__dirname, '../../../..');
const SOURCE = path.join(path.dirname(ROOT), '001-verifiable-local-journey');
const STATE = path.join(ROOT, '.local/v1');
const FILE = path.join(STATE, 'config.json');
const FIXED = Object.freeze({
  root: ROOT,
  branch: '002-brownfield-v1',
  host: '127.0.0.1',
  nodeBin: path.join(
    SOURCE,
    '.local/journey/tools/node-v24.20.0-darwin-arm64/bin',
  ),
  pgBin: path.join(
    SOURCE,
    '.local/journey/tools/Postgres.app/Contents/Versions/16/bin',
  ),
  data: path.join(STATE, 'pgdata'),
  cluster: 'isntgram-002',
  port: 55432,
  appDatabase: 'isntgram_v1',
  appRole: 'isntgram_v1_app',
  testDatabase: 'isntgram_v1_test',
  testRole: 'isntgram_v1_test',
  adminRole: 'isntgram_v1_owner',
  webOrigin: 'http://127.0.0.1:4320',
  apiOrigin: 'http://127.0.0.1:4321',
  storageEndpoint: 'http://127.0.0.1:48333',
  bucket: 'isntgram-v1-media',
});
const SECRET_KEYS = [
  'ISNTGRAM_V1_APP_DB_PASSWORD',
  'ISNTGRAM_V1_TEST_DB_PASSWORD',
  'ISNTGRAM_V1_ADMIN_DB_PASSWORD',
  'ISNTGRAM_V1_FIXTURE_PASSWORD',
  'JWT_SECRET',
  'AUTH_SECRET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
];
const reject = (message) => {
  throw new Error(`V1 configuration rejected: ${message}`);
};

function statePath(candidate, { root = ROOT, state = STATE } = {}) {
  const resolved = path.resolve(candidate);
  if (resolved !== state && !resolved.startsWith(state + path.sep))
    reject('path outside owned v1 state');
  if (fs.realpathSync(root) !== root) reject('checkout path is indirect');
  let current = root;
  for (const part of path.relative(root, resolved).split(path.sep)) {
    current = path.join(current, part);
    const st = fs.lstatSync(current, { throwIfNoEntry: false });
    if (!st) continue;
    if (st.isSymbolicLink() || st.uid !== process.getuid())
      reject('state path is unowned or indirect');
  }
  return resolved;
}

function assertEnvironment(env = process.env, root = ROOT) {
  for (const key of Object.keys(env)) {
    if (
      /^(DATABASE_|DB_|PG|ISNTGRAM_V1_|S3_|AWS_|NEXT_PUBLIC_|NEXTAUTH_|AUTH_SECRET$|JWT_SECRET$|OPENAI_|AI_PROVIDER$|DEMO_|HOST$|PORT$|CORS_ORIGIN$|INTERNAL_API_URL$|SKIP_DB$|NODE_OPTIONS$)/.test(
        key,
      )
    ) {
      reject('inherited application or runtime configuration is not allowed');
    }
  }
  for (const dir of [
    root,
    path.join(root, 'apps/api'),
    path.join(root, 'apps/web'),
  ]) {
    if (
      fs.existsSync(dir) &&
      fs
        .readdirSync(dir)
        .some((n) =>
          /^\.env(?:$|\.local$|\.(?:test|production|development))/.test(n),
        )
    )
      reject('loadable dotenv file');
  }
}

function nativeEnv() {
  return {
    PATH: `${FIXED.nodeBin}:/usr/bin:/bin:/usr/sbin:/sbin`,
    HOME: process.env.HOME,
    LC_ALL: 'C',
    LANG: 'C',
    TMPDIR: process.env.TMPDIR || '/tmp',
    NEXT_TELEMETRY_DISABLED: '1',
  };
}
function native(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: ROOT,
    env: nativeEnv(),
    encoding: 'utf8',
    timeout: 5000,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}
function assertCheckout() {
  if (fs.realpathSync(process.cwd()) !== ROOT || fs.realpathSync(ROOT) !== ROOT)
    reject('wrong cwd');
  if (
    native('/usr/bin/git', ['rev-parse', '--show-toplevel']).trim() !== ROOT ||
    native('/usr/bin/git', ['branch', '--show-current']).trim() !==
      FIXED.branch ||
    !/^https:\/\/github\.com\/mylo-james\/isntgram-ai(?:\.git)?$/.test(
      native('/usr/bin/git', ['remote', 'get-url', 'origin']).trim(),
    )
  )
    reject('wrong checkout identity');
}
function phoneOrigin(value, name) {
  if (typeof value !== 'string') reject(`invalid phone ${name}`);
  let url;
  try {
    url = new URL(value);
  } catch {
    reject(`invalid phone ${name}`);
  }
  if (
    url.protocol !== 'https:' ||
    value !== url.origin ||
    !url.hostname.endsWith('.ts.net') ||
    isIP(url.hostname) ||
    url.hostname.includes('*')
  )
    reject(`invalid phone ${name}`);
  return { origin: url.origin, hostname: url.hostname, port: Number(url.port || 443) };
}
function validatePhoneView(phoneView) {
  if (phoneView === undefined) return undefined;
  if (!phoneView || typeof phoneView !== 'object' || Array.isArray(phoneView))
    reject('invalid phone view');
  const keys = ['webOrigin', 's3Origin', 'serveWebPort', 'serveS3Port'];
  if (Object.keys(phoneView).some(key => !keys.includes(key)) || keys.some(key => !Object.hasOwn(phoneView, key)))
    reject('invalid phone view fields');
  const web = phoneOrigin(phoneView.webOrigin, 'web origin');
  const s3 = phoneOrigin(phoneView.s3Origin, 'S3 origin');
  for (const [name, value] of Object.entries({ serveWebPort: phoneView.serveWebPort, serveS3Port: phoneView.serveS3Port }))
    if (!Number.isSafeInteger(value) || value < 1 || value > 65535 || value === 8443)
      reject(`invalid phone ${name}`);
  if (
    web.hostname !== s3.hostname ||
    web.origin === s3.origin ||
    phoneView.serveWebPort !== web.port ||
    phoneView.serveS3Port !== s3.port ||
    phoneView.serveWebPort === phoneView.serveS3Port
  )
    reject('inconsistent phone view');
  return Object.freeze({
    webOrigin: web.origin,
    s3Origin: s3.origin,
    serveWebPort: phoneView.serveWebPort,
    serveS3Port: phoneView.serveS3Port,
  });
}
function browserOrigins(c) {
  const phoneView = validatePhoneView(c?.phoneView);
  return Object.freeze(phoneView ? [c.webOrigin, phoneView.webOrigin] : [c.webOrigin]);
}
function validate(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    reject('invalid shape');
  const allowed = [
    ...Object.keys(FIXED),
    'secrets',
    'systemId',
    'demoReady',
    'tools',
    'phoneView',
  ];
  if (
    Object.keys(value).some((k) => !allowed.includes(k)) ||
    allowed.filter((k) => k !== 'phoneView').some((k) => !Object.hasOwn(value, k))
  )
    reject('unexpected fields');
  for (const [k, v] of Object.entries(FIXED))
    if (value[k] !== v) reject(`unexpected ${k}`);
  if (value.systemId !== null && !/^\d{19,20}$/.test(value.systemId))
    reject('invalid system ID');
  if (typeof value.demoReady !== 'boolean') reject('invalid demo state');
  if (
    !value.secrets ||
    Object.keys(value.secrets).length !== SECRET_KEYS.length
  )
    reject('invalid secret fields');
  for (const k of SECRET_KEYS)
    if (!/^[A-Za-z0-9_-]{32,100}$/.test(value.secrets[k] || ''))
      reject('invalid private credential shape');
  if (
    !value.tools ||
    Object.keys(value.tools).sort().join(',') !== 'node,postgres' ||
    !Object.values(value.tools).every((x) => /^[a-f0-9]{64}$/.test(x))
  )
    reject('invalid executable identity');
  const phoneView = validatePhoneView(value.phoneView);
  if (phoneView) value.phoneView = phoneView;
  return value;
}
function hashFile(file) {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(file))
    .digest('hex');
}
function verifyTools(c) {
  if (
    hashFile(path.join(c.nodeBin, 'node')) !== c.tools.node ||
    hashFile(path.join(c.pgBin, 'postgres')) !== c.tools.postgres
  )
    reject('executable bytes changed');
  if (
    native(path.join(c.nodeBin, 'node'), ['--version']).trim() !== 'v24.20.0' ||
    !/^postgres \(PostgreSQL\) 16\.15(?: \(Postgres\.app\))?$/.test(
      native(path.join(c.pgBin, 'postgres'), ['--version']).trim(),
    )
  )
    reject('unexpected native version');
}
function privateFile(file) {
  statePath(file);
  const st = fs.lstatSync(file);
  const parent = fs.statSync(path.dirname(file));
  if (
    !st.isFile() ||
    (st.mode & 0o777) !== 0o600 ||
    (parent.mode & 0o777) !== 0o700
  )
    reject('private permissions differ');
}
function load() {
  assertCheckout();
  assertEnvironment();
  privateFile(FILE);
  const value = validate(JSON.parse(fs.readFileSync(FILE, 'utf8')));
  verifyTools(value);
  return value;
}
function create() {
  assertCheckout();
  assertEnvironment();
  statePath(FILE);
  if (fs.existsSync(FILE)) reject('configuration already exists');
  fs.mkdirSync(STATE, { recursive: true, mode: 0o700 });
  if ((fs.statSync(STATE).mode & 0o777) !== 0o700)
    reject('state directory is not private');
  const c = validate({
    ...FIXED,
    systemId: null,
    demoReady: false,
    tools: {
      node: hashFile(path.join(FIXED.nodeBin, 'node')),
      postgres: hashFile(path.join(FIXED.pgBin, 'postgres')),
    },
    secrets: Object.fromEntries(
      SECRET_KEYS.map((k) => [k, crypto.randomBytes(32).toString('base64url')]),
    ),
  });
  verifyTools(c);
  fs.writeFileSync(FILE, JSON.stringify(c, null, 2) + '\n', {
    mode: 0o600,
    flag: 'wx',
  });
  return c;
}
function saveIdentity(systemId) {
  const c = load();
  if (c.systemId !== null) reject('cluster identity already recorded');
  c.systemId = systemId;
  validate(c);
  privateFile(FILE);
  fs.writeFileSync(FILE, JSON.stringify(c, null, 2) + '\n', { mode: 0o600 });
  return c;
}
function database(c, target) {
  if (!['app', 'test', 'admin'].includes(target))
    reject('unknown database target');
  return {
    host: c.host,
    port: c.port,
    user: c[target + 'Role'],
    database: target === 'admin' ? 'postgres' : c[target + 'Database'],
    password: c.secrets[`ISNTGRAM_V1_${target.toUpperCase()}_DB_PASSWORD`],
    ssl: false,
    connectionTimeoutMillis: 5000,
    statement_timeout: 5000,
  };
}
function appEnvironment(c, target = 'app') {
  if (!['app', 'test'].includes(target)) reject('application cannot use admin');
  const db = database(c, target);
  const phoneView = validatePhoneView(c.phoneView);
  const webOrigin = phoneView?.webOrigin || c.webOrigin;
  const mediaHosts = phoneView
    ? `127.0.0.1:48333,${new URL(phoneView.s3Origin).host}`
    : '127.0.0.1:48333';
  return {
    ...nativeEnv(),
    NODE_ENV: 'production',
    DATABASE_SSL: 'false',
    DATABASE_URL: `postgresql://${db.user}:${encodeURIComponent(db.password)}@${db.host}:${db.port}/${db.database}`,
    JWT_SECRET: c.secrets.JWT_SECRET,
    AUTH_SECRET: c.secrets.AUTH_SECRET,
    NEXTAUTH_SECRET: c.secrets.AUTH_SECRET,
    HOST: c.host,
    PORT: target === 'test' ? '4322' : '4321',
    CORS_ORIGIN: c.webOrigin,
    NEXTAUTH_URL: webOrigin,
    NEXT_PUBLIC_APP_URL: webOrigin,
    INTERNAL_API_URL: c.apiOrigin,
    NEXT_PUBLIC_API_URL: c.apiOrigin,
    DEMO_ENABLED: String(c.demoReady),
    NEXT_PUBLIC_DEMO_ENABLED: String(c.demoReady),
    DEMO_TTL_HOURS: '1',
    DEMO_CONTENT_SOURCE: 'curated',
    NEXT_PUBLIC_DEMO_CONTENT_SOURCE: 'curated',
    AI_PROVIDER: 'mock',
    S3_ENDPOINT: c.storageEndpoint,
    S3_PUBLIC_BASE_URL: `${c.storageEndpoint}/${c.bucket}`,
    ...(phoneView ? {
      S3_PRESIGN_ENDPOINT: phoneView.s3Origin,
      S3_DISPLAY_BASE_URL: `${phoneView.s3Origin}/${c.bucket}`,
    } : {}),
    S3_BUCKET: c.bucket,
    S3_REGION: 'us-east-1',
    S3_ACCESS_KEY_ID: c.secrets.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: c.secrets.S3_SECRET_ACCESS_KEY,
    MEDIA_ALLOWED_HOSTS: '127.0.0.1:48333',
    NEXT_PUBLIC_MEDIA_HOSTS: mediaHosts,
    MEDIA_MAX_UPLOAD_BYTES: '5242880',
  };
}
function args(count) {
  const a = process.argv.slice(2).filter((x, i) => !(i === 0 && x === '--'));
  if (a.length !== count) reject('unexpected arguments');
  return a;
}
if (require.main === module) {
  try {
    const [action] = args(1);
    if (!['create', 'show'].includes(action)) reject('use create or show');
    const c = action === 'create' ? create() : load();
    console.log(
      JSON.stringify({
        ...FIXED,
        systemId: c.systemId,
        demoReady: c.demoReady,
        tools: c.tools,
      }),
    );
  } catch {
    console.error(
      'V1 configuration refused; inspect checkout, input names and private file permissions. No secrets displayed.',
    );
    process.exitCode = 1;
  }
}
module.exports = {
  ROOT,
  SOURCE,
  STATE,
  FILE,
  FIXED,
  SECRET_KEYS,
  reject,
  statePath,
  assertEnvironment,
  nativeEnv,
  native,
  assertCheckout,
  validatePhoneView,
  browserOrigins,
  validate,
  hashFile,
  verifyTools,
  privateFile,
  load,
  create,
  saveIdentity,
  database,
  appEnvironment,
  args,
};
