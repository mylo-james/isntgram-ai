'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { JOURNEY, loadPrivateEnvironment } = require('./config.cjs');
const { preflight } = require('./preflight.cjs');

class JourneyError extends Error {}

/** Open only after native identity was established, then check this exact connection. */
async function openJourneyClient() {
  const proof = await preflight('running');
  const environment = loadPrivateEnvironment();
  const client = new Client({
    connectionString: environment.DATABASE_URL,
    ssl: false,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
    application_name: 'isntgram-001-proof',
  });
  try {
    await client.connect();
    const { rows } = await client.query(
      "SELECT current_database() AS database, current_user AS username, current_setting('data_directory') AS directory, current_setting('port') AS port, system_identifier::text AS system_id FROM pg_control_system()",
    );
    const row = rows[0];
    if (
      row.database !== JOURNEY.database ||
      row.username !== JOURNEY.role ||
      row.directory !== JOURNEY.dataDirectory ||
      row.port !== String(JOURNEY.port) ||
      row.system_id !== proof.native.systemId
    ) {
      throw new JourneyError(
        'Connected database identity does not match the owned cluster.',
      );
    }
    return client;
  } catch (error) {
    await client.end().catch(() => {});
    throw error;
  }
}

/** @param {import('pg').Client} client */
async function assertMigrationsCurrent(client) {
  const directory = path.join(JOURNEY.root, 'apps/api/dist/migrations');
  const expected = fs
    .readdirSync(directory)
    .filter((name) => name.endsWith('.js'))
    .flatMap((file) => {
      const values = Object.values(require(path.join(directory, file)));
      return values
        .filter(
          (value) =>
            typeof value === 'function' &&
            typeof value.prototype?.up === 'function',
        )
        .map((value) => value.name);
    });
  if (!expected.length)
    throw new JourneyError(
      'Build the API migrations before preparing the fixture.',
    );
  const { rows } = await client.query(
    'SELECT name FROM migrations ORDER BY timestamp',
  );
  const applied = rows.map((row) => row.name);
  if (
    expected.length !== applied.length ||
    expected.some((name) => !applied.includes(name))
  ) {
    throw new JourneyError(
      'Applied migrations differ from this API build; run the guarded migration command.',
    );
  }
  return applied;
}

/** Never expose database error detail, credentials or the private environment. */
function reportFailure(operation, error) {
  const message =
    error instanceof JourneyError
      ? error.message
      : 'Check the selected local stack and private configuration.';
  console.error(`Journey ${operation} failed: ${message}`);
  process.exitCode = 1;
}

module.exports = {
  JourneyError,
  openJourneyClient,
  assertMigrationsCurrent,
  reportFailure,
};
