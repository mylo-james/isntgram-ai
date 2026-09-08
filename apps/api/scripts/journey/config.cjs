'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const REPOSITORY_ROOT = path.resolve(__dirname, '../../../..');
const JOURNEY = Object.freeze({
  root: REPOSITORY_ROOT,
  stateDirectory: path.join(REPOSITORY_ROOT, '.local', 'journey'),
  environmentFile: path.join(REPOSITORY_ROOT, '.local', 'journey', 'env.sh'),
  dataDirectory: path.join(REPOSITORY_ROOT, '.local', 'journey', 'pgdata'),
  logDirectory: path.join(REPOSITORY_ROOT, '.local', 'journey', 'logs'),
  evidenceDirectory: path.join(
    REPOSITORY_ROOT,
    '.local',
    'journey',
    'evidence',
  ),
  postgresBinDirectory: path.join(
    REPOSITORY_ROOT,
    '.local',
    'journey',
    'tools',
    'Postgres.app',
    'Contents',
    'Versions',
    '16',
    'bin',
  ),
  host: '127.0.0.1',
  port: 55431,
  database: 'isntgram_journey',
  role: 'isntgram_dev',
  clusterName: 'isntgram-001',
  postgresVersionPrefix: '16.15',
});

const REQUIRED_ENVIRONMENT = Object.freeze([
  'ISNTGRAM_JOURNEY_PG_PASSWORD',
  'ISNTGRAM_JOURNEY_FIXTURE_PASSWORD',
  'JWT_SECRET',
  'AUTH_SECRET',
  'NEXTAUTH_SECRET',
  'DATABASE_URL',
  'NODE_ENV',
  'DATABASE_SSL',
  'HOST',
  'PORT',
  'CORS_ORIGIN',
  'NEXTAUTH_URL',
  'NEXT_PUBLIC_APP_URL',
  'INTERNAL_API_URL',
  'NEXT_PUBLIC_API_URL',
  'DEMO_ENABLED',
  'NEXT_PUBLIC_DEMO_ENABLED',
]);
const FORBIDDEN_ENVIRONMENT = Object.freeze([
  'SKIP_DB',
  'OPENAI_API_KEY',
  'S3_BUCKET',
  'S3_REGION',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'S3_ENDPOINT',
  'S3_PUBLIC_BASE_URL',
]);
const SAFE_ASSIGNMENT = /^export ([A-Z][A-Z0-9_]*)='([^\n']*)'$/;

/** @param {string} message */
function reject(message) {
  throw new Error(`Journey configuration rejected: ${message}`);
}

/** @param {string} candidate @param {string} ancestor */
function assertContainedPath(candidate, ancestor) {
  const relative = path.relative(ancestor, candidate);
  if (
    relative === '' ||
    relative.startsWith('..') ||
    path.isAbsolute(relative)
  ) {
    reject('journey state path escapes the canonical repository');
  }
}

/** @param {string} filePath @param {typeof fs =} filesystem */
function assertPrivateEnvironmentFile(filePath, filesystem = fs) {
  const link = filesystem.lstatSync(filePath);
  if (link.isSymbolicLink())
    reject('private environment file must not be a symlink');
  const stat = filesystem.statSync(filePath);
  if (!stat.isFile()) reject('private environment path is not a regular file');
  if ((stat.mode & 0o077) !== 0)
    reject('private environment file must be mode 0600');
  const parentStat = filesystem.statSync(path.dirname(filePath));
  if (!parentStat.isDirectory() || (parentStat.mode & 0o077) !== 0) {
    reject('journey state directory must be mode 0700');
  }
}

/** @param {string} source */
function parsePrivateEnvironment(source) {
  /** @type {Record<string, string>} */
  const parsed = {};
  for (const line of source.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue;
    const match = SAFE_ASSIGNMENT.exec(line);
    if (!match)
      reject('private environment contains an unsupported assignment');
    const [, key, value] = match;
    if (Object.hasOwn(parsed, key))
      reject('private environment contains a duplicate key');
    parsed[key] = value;
  }
  return parsed;
}

/** @param {Record<string, string>} environment */
function validatePrivateEnvironment(environment) {
  for (const key of REQUIRED_ENVIRONMENT) {
    if (!environment[key]) reject(`private environment is missing ${key}`);
  }
  for (const key of FORBIDDEN_ENVIRONMENT) {
    if (environment[key] !== undefined)
      reject(`private environment must not define ${key}`);
  }
  if (environment.AUTH_SECRET !== environment.NEXTAUTH_SECRET) {
    reject('AUTH_SECRET and NEXTAUTH_SECRET must agree');
  }
  const expected = {
    NODE_ENV: 'production',
    DATABASE_SSL: 'false',
    HOST: JOURNEY.host,
    PORT: '4311',
    CORS_ORIGIN: 'http://127.0.0.1:4310',
    NEXTAUTH_URL: 'http://127.0.0.1:4310',
    NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:4310',
    INTERNAL_API_URL: 'http://127.0.0.1:4311',
    NEXT_PUBLIC_API_URL: 'http://127.0.0.1:4311',
    DEMO_ENABLED: 'false',
    NEXT_PUBLIC_DEMO_ENABLED: 'false',
  };
  for (const [key, value] of Object.entries(expected)) {
    if (environment[key] !== value)
      reject(`private environment has an unexpected ${key}`);
  }
  let databaseUrl;
  try {
    databaseUrl = new URL(environment.DATABASE_URL);
  } catch {
    reject('DATABASE_URL has an invalid shape');
  }
  if (
    !['postgres:', 'postgresql:'].includes(databaseUrl.protocol) ||
    databaseUrl.hostname !== JOURNEY.host ||
    (databaseUrl.port || '5432') !== String(JOURNEY.port) ||
    decodeURIComponent(databaseUrl.username) !== JOURNEY.role ||
    databaseUrl.pathname !== `/${JOURNEY.database}` ||
    databaseUrl.search ||
    databaseUrl.hash
  ) {
    reject('DATABASE_URL does not target the fixed journey cluster');
  }
  if (
    decodeURIComponent(databaseUrl.password) !==
    environment.ISNTGRAM_JOURNEY_PG_PASSWORD
  ) {
    reject(
      'DATABASE_URL password does not match the private PostgreSQL password',
    );
  }
  return Object.freeze({ ...environment });
}

/** Reject any symlink from the repository through the selected local state path. */
function assertStatePath(candidate) {
  const absolute = path.resolve(candidate);
  assertContainedPath(absolute, JOURNEY.root);
  let current = JOURNEY.root;
  for (const segment of path.relative(JOURNEY.root, absolute).split(path.sep)) {
    current = path.join(current, segment);
    if (
      !fs.existsSync(current) &&
      !fs.lstatSync(current, { throwIfNoEntry: false })
    )
      continue;
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink() || stat.uid !== process.getuid())
      reject('state path must be owned and must not contain symlinks');
    if (fs.realpathSync(current) !== current)
      reject('state path resolves outside its declared location');
  }
}

function assertNoLoadableDotenv(root = JOURNEY.root) {
  for (const directory of [
    root,
    path.join(root, 'apps/api'),
    path.join(root, 'apps/web'),
  ]) {
    if (!fs.existsSync(directory)) continue;
    if (
      fs
        .readdirSync(directory)
        .some((name) =>
          /^\.env(?:$|\.local$|\.(?:test|production|development))/.test(name),
        )
    )
      reject(
        'remove conflicting loadable dotenv inputs from this checkout before using the journey',
      );
  }
}

function assertNoInheritedConflicts(environment, expected = {}) {
  for (const [key, value] of Object.entries(environment)) {
    if (value === undefined) continue;
    if (
      FORBIDDEN_ENVIRONMENT.includes(key) ||
      ((/^(?:DATABASE_|DB_|PG)/.test(key) ||
        REQUIRED_ENVIRONMENT.includes(key)) &&
        value !== expected[key])
    )
      reject(
        'inherited application configuration conflicts with the selected private environment',
      );
  }
}

function loadPrivateEnvironment(
  filePath = JOURNEY.environmentFile,
  filesystem = fs,
) {
  assertStatePath(filePath);
  if (filesystem.realpathSync(JOURNEY.root) !== JOURNEY.root)
    reject('canonical repository root must not be a symlink');
  assertPrivateEnvironmentFile(filePath, filesystem);
  const environment = validatePrivateEnvironment(
    parsePrivateEnvironment(filesystem.readFileSync(filePath, 'utf8')),
  );
  assertNoLoadableDotenv();
  assertNoInheritedConflicts(process.env, environment);
  return environment;
}

/** @param {string} databaseUrl */
function redactDatabaseUrl(databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    return `${parsed.protocol}//${parsed.hostname}:${parsed.port || '5432'}${parsed.pathname}`;
  } catch {
    return '[invalid database URL]';
  }
}

/** @param {string} key @param {string} value */
function formatPrivateAssignment(key, value) {
  if (
    !/^[A-Z][A-Z0-9_]*$/.test(key) ||
    value.includes('\n') ||
    value.includes("'")
  ) {
    reject('private environment value cannot be safely encoded');
  }
  return `export ${key}='${value}'`;
}

function generateSecret() {
  return crypto.randomBytes(32).toString('base64url');
}

/** @param {typeof fs =} filesystem */
function createPrivateEnvironment(filesystem = fs) {
  if (filesystem.realpathSync(process.cwd()) !== JOURNEY.root)
    reject('run configuration creation from the selected checkout root');
  assertStatePath(JOURNEY.environmentFile);
  assertNoLoadableDotenv();
  assertNoInheritedConflicts(process.env);
  if (filesystem.existsSync(JOURNEY.environmentFile))
    reject('private environment already exists');
  filesystem.mkdirSync(JOURNEY.stateDirectory, {
    recursive: true,
    mode: 0o700,
  });
  filesystem.chmodSync(JOURNEY.stateDirectory, 0o700);
  const pgPassword = generateSecret();
  const authSecret = generateSecret();
  const values = {
    ISNTGRAM_JOURNEY_PG_PASSWORD: pgPassword,
    ISNTGRAM_JOURNEY_FIXTURE_PASSWORD: `Jf1_${generateSecret()}`,
    JWT_SECRET: generateSecret(),
    AUTH_SECRET: authSecret,
    NEXTAUTH_SECRET: authSecret,
    DATABASE_URL: `postgresql://${JOURNEY.role}:${encodeURIComponent(pgPassword)}@${JOURNEY.host}:${JOURNEY.port}/${JOURNEY.database}`,
    NODE_ENV: 'production',
    DATABASE_SSL: 'false',
    HOST: JOURNEY.host,
    PORT: '4311',
    CORS_ORIGIN: 'http://127.0.0.1:4310',
    NEXTAUTH_URL: 'http://127.0.0.1:4310',
    NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:4310',
    INTERNAL_API_URL: 'http://127.0.0.1:4311',
    NEXT_PUBLIC_API_URL: 'http://127.0.0.1:4311',
    DEMO_ENABLED: 'false',
    NEXT_PUBLIC_DEMO_ENABLED: 'false',
  };
  validatePrivateEnvironment(values);
  filesystem.writeFileSync(
    JOURNEY.environmentFile,
    `${Object.entries(values)
      .map(([key, value]) => formatPrivateAssignment(key, value))
      .join('\n')}\n`,
    { mode: 0o600, flag: 'wx' },
  );
  filesystem.chmodSync(JOURNEY.environmentFile, 0o600);
  return loadPrivateEnvironment();
}

function commandArguments(count, supplied = process.argv.slice(2)) {
  const args = supplied[0] === '--' ? supplied.slice(1) : supplied;
  if (args.length !== count) reject('unexpected command arguments');
  return args;
}

if (require.main === module) {
  try {
    const [action] = commandArguments(1);
    if (action === 'create') {
      createPrivateEnvironment();
      console.log(
        `Created private journey configuration at ${path.relative(JOURNEY.root, JOURNEY.environmentFile)}`,
      );
    } else if (action === 'show') {
      const env = loadPrivateEnvironment();
      console.log(
        JSON.stringify({
          host: JOURNEY.host,
          port: JOURNEY.port,
          database: JOURNEY.database,
          role: JOURNEY.role,
          databaseUrl: redactDatabaseUrl(env.DATABASE_URL),
        }),
      );
    } else {
      throw new Error('Usage: config.cjs create|show');
    }
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message.replace(
            /postgres(?:ql)?:\/\/\S+/gi,
            '[redacted database URL]',
          )
        : 'Journey configuration failed',
    );
    process.exitCode = 1;
  }
}

module.exports = {
  commandArguments,
  FORBIDDEN_ENVIRONMENT,
  JOURNEY,
  REQUIRED_ENVIRONMENT,
  assertContainedPath,
  assertStatePath,
  assertNoInheritedConflicts,
  assertNoLoadableDotenv,
  assertPrivateEnvironmentFile,
  createPrivateEnvironment,
  formatPrivateAssignment,
  loadPrivateEnvironment,
  parsePrivateEnvironment,
  redactDatabaseUrl,
  validatePrivateEnvironment,
};
