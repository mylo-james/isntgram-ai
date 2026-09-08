'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { selectTestDatabase } = require('../../test/test-database-target.cjs');

const ciEnvironment = {
  ISNTGRAM_TEST_POSTGRES: '1',
  GITHUB_ACTIONS: 'true',
  CI: 'true',
  DATABASE_URL: 'postgresql://postgres:secret@127.0.0.1:5432/isntgram_test',
};

test('selects SQLite for a clean local test environment', () => {
  assert.deepEqual(selectTestDatabase({}), { kind: 'sqlite' });
  assert.deepEqual(selectTestDatabase({ NODE_ENV: 'test' }), {
    kind: 'sqlite',
  });
});

test('rejects an explicit non-test local environment', () => {
  assert.throws(
    () => selectTestDatabase({ NODE_ENV: 'production' }),
    /unset or test/,
  );
});

test('rejects a local inherited database URL without exposing it', () => {
  const foreignUrl =
    'postgresql://user:foreign-secret@127.0.0.1:55431/isntgram_journey';
  assert.throws(
    () => selectTestDatabase({ NODE_ENV: 'test', DATABASE_URL: foreignUrl }),
    (error) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /connection variables/);
      assert.doesNotMatch(
        error.message,
        /foreign-secret|55431|isntgram_journey/,
      );
      return true;
    },
  );
});

test('rejects local PostgreSQL opt-in before a connection can be selected', () => {
  assert.throws(
    () =>
      selectTestDatabase({
        NODE_ENV: 'test',
        ISNTGRAM_TEST_POSTGRES: '1',
        DATABASE_URL:
          'postgresql://postgres:secret@127.0.0.1:5432/isntgram_test',
      }),
    /GitHub Actions CI/,
  );
});

test('selects only the fixed GitHub Actions PostgreSQL service', () => {
  const selected = selectTestDatabase(ciEnvironment);
  assert.equal(selected.kind, 'postgres');
  assert.equal(selected.url, ciEnvironment.DATABASE_URL);
});

test('rejects a journey target even when CI flags are present', () => {
  const journeyUrl =
    'postgresql://postgres:journey-secret@127.0.0.1:55431/isntgram_journey';
  assert.throws(
    () => selectTestDatabase({ ...ciEnvironment, DATABASE_URL: journeyUrl }),
    (error) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /fixed CI service/);
      assert.doesNotMatch(
        error.message,
        /journey-secret|55431|isntgram_journey/,
      );
      return true;
    },
  );
});

test('rejects extra PostgreSQL connection variables in CI mode', () => {
  assert.throws(
    () => selectTestDatabase({ ...ciEnvironment, PGHOST: '127.0.0.1' }),
    /allow only DATABASE_URL/,
  );
});

test('rejects a hostname alias for the fixed CI service', () => {
  assert.throws(
    () =>
      selectTestDatabase({
        ...ciEnvironment,
        DATABASE_URL: ciEnvironment.DATABASE_URL.replace(
          '127.0.0.1',
          'localhost',
        ),
      }),
    /fixed CI service/,
  );
});
