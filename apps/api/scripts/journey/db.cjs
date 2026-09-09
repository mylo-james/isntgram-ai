'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const {
  JOURNEY,
  commandArguments,
  loadPrivateEnvironment,
  assertStatePath,
} = require('./config.cjs');
const {
  preflight,
  assertCanonicalRepository,
  nativeExecutor,
  nativeRunningIdentity,
  inspectSqlIdentity,
} = require('./preflight.cjs');

const ACTIONS = new Set(['init', 'start', 'status', 'stop']);

async function ensureJourneyDatabase(environment) {
  const native = nativeRunningIdentity();
  await inspectSqlIdentity(environment, native, 'postgres');
  const client = new Client({
    host: JOURNEY.host,
    port: JOURNEY.port,
    user: JOURNEY.role,
    password: environment.ISNTGRAM_JOURNEY_PG_PASSWORD,
    database: 'postgres',
    ssl: false,
    connectionTimeoutMillis: 5000,
    statement_timeout: 5000,
  });
  try {
    await client.connect();
    const identity = await client.query(
      "SELECT system_identifier::text AS id, current_setting('data_directory') AS directory FROM pg_control_system()",
    );
    if (
      identity.rows[0].id !== native.systemId ||
      identity.rows[0].directory !== JOURNEY.dataDirectory
    )
      throw new Error(
        'Native database identity changed before database creation',
      );
    const result = await client.query(
      'SELECT datname FROM pg_database WHERE datname = $1',
      [JOURNEY.database],
    );
    if (!result.rowCount)
      await client.query(
        'CREATE DATABASE "isntgram_journey" OWNER "isntgram_dev"',
      );
  } finally {
    await client.end().catch(() => {});
  }
}

async function runDbCommand(action) {
  if (!ACTIONS.has(action))
    throw new Error(
      'Journey database action must be init, start, status, or stop',
    );
  assertCanonicalRepository();
  const environment = loadPrivateEnvironment();
  const binary = (name) => path.join(JOURNEY.postgresBinDirectory, name);
  if (action === 'init') {
    await preflight('bootstrap');
    // Retained with the other private configuration; never placed in a command argument.
    const passwordFile = path.join(JOURNEY.stateDirectory, 'initdb-password');
    assertStatePath(passwordFile);
    if (fs.existsSync(passwordFile))
      throw new Error(
        'Initialization password file already exists; inspect the previous attempt',
      );
    fs.writeFileSync(
      passwordFile,
      `${environment.ISNTGRAM_JOURNEY_PG_PASSWORD}\n`,
      { mode: 0o600, flag: 'wx' },
    );
    nativeExecutor(
      binary('initdb'),
      [
        '-D',
        JOURNEY.dataDirectory,
        '--username',
        JOURNEY.role,
        '--encoding=UTF8',
        '--locale=C',
        '--auth-host=scram-sha-256',
        '--auth-local=scram-sha-256',
        '--pwfile',
        passwordFile,
      ],
      { timeout: 30000 },
    );
    return preflight('stopped');
  }
  if (action === 'start') {
    const before = await preflight('stopped');
    assertStatePath(JOURNEY.logDirectory);
    fs.mkdirSync(JOURNEY.logDirectory, { recursive: true, mode: 0o700 });
    nativeExecutor(
      binary('pg_ctl'),
      [
        '-D',
        JOURNEY.dataDirectory,
        '-l',
        path.join(JOURNEY.logDirectory, 'postgresql.log'),
        '-w',
        '-t',
        '30',
        'start',
        '-o',
        `-c cluster_name=${JOURNEY.clusterName} -c listen_addresses=${JOURNEY.host} -c port=${JOURNEY.port} -c unix_socket_directories=''`,
      ],
      { timeout: 35000 },
    );
    const after = nativeRunningIdentity();
    if (before.native.systemId !== after.systemId)
      throw new Error('Database control identity changed during start');
    await ensureJourneyDatabase(environment);
    return preflight('running');
  }
  if (action === 'stop') {
    // Native identity remains usable even during an API/SQL dependency failure.
    const before = nativeRunningIdentity();
    nativeExecutor(
      binary('pg_ctl'),
      ['-D', JOURNEY.dataDirectory, '-w', '-t', '30', 'stop', '-m', 'fast'],
      { timeout: 35000 },
    );
    const after = await preflight('stopped');
    if (before.systemId !== after.native.systemId)
      throw new Error('Database control identity changed during stop');
    return after;
  }
  try {
    return await preflight('running');
  } catch {
    return preflight('stopped');
  }
}

if (require.main === module) {
  Promise.resolve().then(() => runDbCommand(commandArguments(1)[0]))
    .then((result) => console.log(JSON.stringify(result)))
    .catch(() => {
      console.error(
        'Journey database action failed. Inspect the owned native state and private logs; no force-kill or cleanup was attempted.',
      );
      process.exitCode = 1;
    });
}

module.exports = { ACTIONS, runDbCommand, ensureJourneyDatabase };
