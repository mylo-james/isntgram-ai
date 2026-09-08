'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { Client } = require('pg');
const {
  JOURNEY,
  commandArguments,
  assertContainedPath,
  assertStatePath,
  loadPrivateEnvironment,
} = require('./config.cjs');

function reject(message) {
  throw new Error(`Journey preflight rejected: ${message}`);
}

function nativeExecutor(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: JOURNEY.root,
    timeout: 5000,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, LC_ALL: 'C' },
    ...options,
  });
}

function assertCanonicalRepository({
  root = JOURNEY.root,
  execute = nativeExecutor,
} = {}) {
  if (fs.realpathSync(root) !== root || fs.realpathSync(process.cwd()) !== root)
    reject('run from the selected repository root');
  const gitRoot = String(
    execute('git', ['rev-parse', '--show-toplevel']),
  ).trim();
  if (
    gitRoot !== root ||
    JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
      .name !== 'isntgram-ai'
  )
    reject('checkout identity differs');
  const remote = String(execute('git', ['remote', 'get-url', 'origin'])).trim();
  if (
    !/^https:\/\/github\.com\/mylo-james\/isntgram-ai(?:\.git)?$/.test(
      remote,
    ) &&
    remote !== 'git@github.com:mylo-james/isntgram-ai.git'
  )
    reject('repository origin differs');
  const branch = String(execute('git', ['branch', '--show-current'])).trim();
  if (branch !== '001-verifiable-local-journey')
    reject('select the approved journey feature branch');
  return root;
}

function assertJourneyDirectory(directory = JOURNEY.dataDirectory) {
  assertContainedPath(directory, JOURNEY.root);
  assertStatePath(directory);
  if (!fs.existsSync(directory)) return { state: 'absent' };
  if (!fs.statSync(directory).isDirectory())
    reject('data path is not a directory');
  if (!fs.readdirSync(directory).length) return { state: 'empty' };
  const versionFile = path.join(directory, 'PG_VERSION');
  assertStatePath(versionFile);
  if (
    !fs.existsSync(versionFile) ||
    fs.readFileSync(versionFile, 'utf8').trim() !== '16'
  )
    reject('existing data is not the owned PostgreSQL 16 cluster');
  return { state: 'postgres-data' };
}

/** @param {number} [port] */
function inspectPort(port = JOURNEY.port, execute = nativeExecutor) {
  let output;
  try {
    output = String(
      execute('/usr/sbin/lsof', [
        '-nP',
        `-iTCP:${port}`,
        '-sTCP:LISTEN',
        '-Fpn',
      ]),
    );
  } catch (error) {
    if (
      error.status === 1 &&
      !String(error.stderr || '').trim() &&
      !String(error.stdout || '').trim()
    )
      return [];
    reject('cannot inspect listener ownership; no action was taken');
  }
  return output
    .split(/\n/)
    .filter((line) => line.startsWith('p'))
    .map((line) => Number(line.slice(1)));
}

function assertExpectedPort(port, listeners) {
  if (listeners.length) reject(`port ${port} is occupied; no action was taken`);
  return true;
}

function controlIdentity(execute = nativeExecutor) {
  assertJourneyDirectory();
  const version = String(
    execute(path.join(JOURNEY.postgresBinDirectory, 'postgres'), ['--version']),
  ).trim();
  if (!/^postgres \(PostgreSQL\) 16\.15(?: \(Postgres\.app\))?$/.test(version))
    reject('PostgreSQL binary version differs from the approved artifact');
  assertStatePath(path.join(JOURNEY.dataDirectory, 'global/pg_control'));
  const output = String(
    execute(path.join(JOURNEY.postgresBinDirectory, 'pg_controldata'), [
      JOURNEY.dataDirectory,
    ]),
  );
  const systemId = output.match(/Database system identifier:\s*(\d+)/)?.[1];
  const state = output.match(/Database cluster state:\s*([^\n]+)/)?.[1]?.trim();
  if (!systemId || !state)
    reject('native database control identity is unavailable');
  return {
    systemId,
    state,
    pgVersion: '16.15',
    dataDirectory: JOURNEY.dataDirectory,
  };
}

function nativeRunningIdentity(execute = nativeExecutor) {
  const native = controlIdentity(execute);
  const pidFile = path.join(JOURNEY.dataDirectory, 'postmaster.pid');
  assertStatePath(pidFile);
  const lines = fs.readFileSync(pidFile, 'utf8').split(/\n/);
  const pid = Number(lines[0]);
  if (
    !Number.isSafeInteger(pid) ||
    pid < 2 ||
    lines[1] !== JOURNEY.dataDirectory ||
    lines[3] !== String(JOURNEY.port)
  )
    reject('native postmaster identity differs');
  const status = String(
    execute(path.join(JOURNEY.postgresBinDirectory, 'pg_ctl'), [
      '-D',
      JOURNEY.dataDirectory,
      'status',
    ]),
  );
  if (!status.includes(`PID: ${pid})`))
    reject('pg_ctl and postmaster identity disagree');
  const listeners = inspectPort(JOURNEY.port, execute);
  if (listeners.length !== 1 || listeners[0] !== pid)
    reject('database listener is not the identified postmaster');
  const executable = fs.realpathSync(
    path.join(JOURNEY.postgresBinDirectory, 'postgres'),
  );
  const text = String(
    execute('/usr/sbin/lsof', ['-a', '-p', String(pid), '-d', 'txt', '-Fn']),
  );
  const cwd = String(
    execute('/usr/sbin/lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn']),
  );
  if (
    !text.split(/\n/).includes(`n${executable}`) ||
    !cwd.split(/\n/).includes(`n${JOURNEY.dataDirectory}`)
  )
    reject('database process executable or cwd differs');
  const uid = String(execute('ps', ['-p', String(pid), '-o', 'uid='])).trim();
  if (uid !== String(process.getuid()))
    reject('database process belongs to a different OS user');
  const processStartedAt = String(
    execute('ps', ['-p', String(pid), '-o', 'lstart=']),
  ).trim();
  return {
    ...native,
    pid,
    processStartedAt,
    postmasterStartedAt: lines[2],
    executable,
  };
}

/** @param {Record<string,string>} environment @param {{systemId:string}} native @param {string} [database] */
async function inspectSqlIdentity(
  environment,
  native,
  database = JOURNEY.database,
) {
  if (![JOURNEY.database, 'postgres'].includes(database))
    reject('unsupported owned database name');
  const client = new Client({
    host: JOURNEY.host,
    port: JOURNEY.port,
    user: JOURNEY.role,
    password: environment.ISNTGRAM_JOURNEY_PG_PASSWORD,
    database,
    ssl: false,
    connectionTimeoutMillis: 5000,
    statement_timeout: 5000,
  });
  try {
    await client.connect();
    const { rows } = await client.query(
      "SELECT current_database() AS database, current_user AS username, current_setting('data_directory') AS directory, current_setting('port') AS port, current_setting('server_version_num') AS version, current_setting('listen_addresses') AS listen, current_setting('unix_socket_directories') AS sockets, system_identifier::text AS system_id FROM pg_control_system()",
    );
    const row = rows[0];
    if (
      row.database !== database ||
      row.username !== JOURNEY.role ||
      row.directory !== JOURNEY.dataDirectory ||
      row.port !== String(JOURNEY.port) ||
      row.version !== '160015' ||
      row.listen !== JOURNEY.host ||
      row.sockets !== '' ||
      row.system_id !== native.systemId
    )
      reject('SQL identity does not match the native owned cluster');
    return {
      dataDirectory: row.directory,
      port: row.port,
      database: row.database,
      user: row.username,
      version: row.version,
      systemId: row.system_id,
    };
  } finally {
    await client.end().catch(() => {});
  }
}

async function preflight(mode) {
  if (!['bootstrap', 'running', 'stopped'].includes(mode))
    reject('mode must be bootstrap, running, or stopped');
  const root = assertCanonicalRepository();
  const environment = loadPrivateEnvironment();
  const data = assertJourneyDirectory();
  if (mode === 'bootstrap') {
    if (data.state !== 'absent')
      reject('initialization requires an absent data directory');
    for (const port of [JOURNEY.port, 4310, 4311])
      assertExpectedPort(port, inspectPort(port));
    return { mode, root, dataState: data.state, port: JOURNEY.port };
  }
  if (data.state !== 'postgres-data')
    reject('initialize the owned PostgreSQL cluster first');
  if (mode === 'stopped') {
    assertExpectedPort(JOURNEY.port, inspectPort());
    if (fs.existsSync(path.join(JOURNEY.dataDirectory, 'postmaster.pid')))
      reject('postmaster state still exists; inspect it before restart');
    const native = controlIdentity();
    if (native.state !== 'shut down')
      reject('cluster is not cleanly stopped; recovery requires inspection');
    return { mode, root, dataState: data.state, port: JOURNEY.port, native };
  }
  const native = nativeRunningIdentity();
  const sql = await inspectSqlIdentity(environment, native);
  return { mode, root, dataState: data.state, port: JOURNEY.port, native, sql };
}

function safeResult(result) {
  return result;
}

if (require.main === module) {
  Promise.resolve().then(() => preflight(commandArguments(1)[0]))
    .then((result) => console.log(JSON.stringify(safeResult(result))))
    .catch(() => {
      console.error(
        'Journey preflight failed. Check checkout, private configuration and native service identity; no mutation occurred.',
      );
      process.exitCode = 1;
    });
}

module.exports = {
  assertCanonicalRepository,
  assertExpectedPort,
  assertJourneyDirectory,
  controlIdentity,
  inspectPort,
  inspectSqlIdentity,
  nativeExecutor,
  nativeRunningIdentity,
  preflight,
  safeResult,
};
