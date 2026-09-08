'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { JOURNEY, loadPrivateEnvironment, commandArguments } = require('./config.cjs');
const {
  JourneyError,
  openJourneyClient,
  assertMigrationsCurrent,
  reportFailure,
} = require('./sql.cjs');

/** @param {import('pg').Client} client */
async function assertPgcryptoAvailable(client) {
  const result = await client.query(
    "SELECT name FROM pg_available_extensions WHERE name = 'pgcrypto'",
  );
  if (result.rowCount !== 1)
    throw new JourneyError(
      'pgcrypto is unavailable in the selected PostgreSQL bundle.',
    );
}

async function runMigrations() {
  const environment = loadPrivateEnvironment();
  const client = await openJourneyClient();
  try {
    await assertPgcryptoAvailable(client);
  } finally {
    await client.end();
  }
  const log = fs.openSync(
    path.join(JOURNEY.logDirectory, 'migrations.log'),
    'a',
    0o600,
  );
  let result;
  try {
    result = spawnSync(
      process.execPath,
      [path.join(JOURNEY.root, 'apps/api/dist/run-migrations.js')],
      {
        cwd: JOURNEY.root,
        env: { ...process.env, ...environment },
        stdio: ['ignore', log, log],
        timeout: 60000,
      },
    );
  } finally {
    fs.closeSync(log);
  }
  if (result.status !== 0)
    throw new JourneyError(
      'Migrations failed; inspect the private migration log locally.',
    );
  const verified = await openJourneyClient();
  try {
    return {
      migrations: await assertMigrationsCurrent(verified),
      database: JOURNEY.database,
    };
  } finally {
    await verified.end();
  }
}

if (require.main === module) {
  Promise.resolve().then(() => { commandArguments(0); return runMigrations(); })
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => reportFailure('migration', error));
}

module.exports = { assertPgcryptoAvailable, runMigrations };
