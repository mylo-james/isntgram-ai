'use strict';

const CONNECTION_VARIABLE = /^(?:DATABASE_URL|DB_|DATABASE_|PG)/;

function connectionVariableNames(env) {
  return Object.keys(env).filter(
    (name) => CONNECTION_VARIABLE.test(name) && env[name] !== undefined,
  );
}

function reject(message) {
  // Do not include environment values here: DATABASE_URL can contain credentials.
  throw new Error(`Test database target rejected: ${message}`);
}

function selectTestDatabase(env = process.env) {
  const postgresRequested = env.ISNTGRAM_TEST_POSTGRES === '1';

  if (!postgresRequested) {
    if (env.NODE_ENV !== undefined && env.NODE_ENV !== 'test') {
      reject('local tests require NODE_ENV to be unset or test');
    }

    const connectionVariables = connectionVariableNames(env);
    if (connectionVariables.length > 0) {
      reject('local tests must not inherit database connection variables');
    }

    return { kind: 'sqlite' };
  }

  if (env.GITHUB_ACTIONS !== 'true' || env.CI !== 'true') {
    reject('PostgreSQL integration tests require GitHub Actions CI');
  }

  const connectionVariables = connectionVariableNames(env).filter(
    (name) => name !== 'DATABASE_URL',
  );
  if (connectionVariables.length > 0) {
    reject('PostgreSQL integration tests allow only DATABASE_URL');
  }

  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    reject('PostgreSQL integration tests require DATABASE_URL');
  }

  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    reject('PostgreSQL integration tests require a valid fixed service URL');
  }

  if (
    !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
    parsed.hostname !== '127.0.0.1' ||
    (parsed.port || '5432') !== '5432' ||
    decodeURIComponent(parsed.username) !== 'postgres' ||
    parsed.pathname !== '/isntgram_test' ||
    parsed.search !== '' ||
    parsed.hash !== ''
  ) {
    reject('PostgreSQL integration URL must target the fixed CI service');
  }

  return { kind: 'postgres', url: databaseUrl };
}

module.exports = { selectTestDatabase };
