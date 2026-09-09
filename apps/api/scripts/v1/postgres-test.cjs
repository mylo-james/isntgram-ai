'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { ROOT, load, nativeEnv, args } = require('./config.cjs');
const { connect } = require('./preflight.cjs');

async function run() {
  args(0);
  const c = load();
  const client = await connect(c, 'test');
  try {
    const tables = [
      'users',
      'posts',
      'likes',
      'comments',
      'comment_likes',
      'follows',
      'notifications',
      'media_uploads',
    ];
    const owned = await client.query(
      `SELECT namespace.nspname AS schema, pg_get_userbyid(namespace.nspowner) AS owner, current_user AS role
       FROM pg_namespace namespace
       WHERE namespace.nspname LIKE 'v1_migration_%' ORDER BY namespace.nspname`,
    );
    for (const row of owned.rows) {
      if (
        !/^v1_migration_[0-9a-f]{32}$/.test(row.schema) ||
        row.owner !== row.role
      )
        throw new Error('Unrecognized retained migration schema');
    }
    const schemas = ['public', ...owned.rows.map((row) => row.schema)];
    const relations = await client.query(
      `SELECT schemaname, tablename, tableowner, current_user AS role FROM pg_tables
       WHERE schemaname = ANY($1) AND tablename = ANY($2) ORDER BY schemaname, tablename`,
      [schemas, tables],
    );
    let records = 0;
    for (const row of relations.rows) {
      if (
        !schemas.includes(row.schemaname) ||
        !tables.includes(row.tablename) ||
        row.tableowner !== row.role
      )
        throw new Error('Unowned retained test table');
      // Both names are exact allowlisted values before identifier interpolation.
      const result = await client.query(
        `SELECT count(*)::text AS count FROM "${row.schemaname}"."${row.tablename}"`,
      );
      records += Number(result.rows[0].count);
      if (!Number.isSafeInteger(records) || records + 100 > 1000)
        throw new Error('Retained test record budget would be exceeded');
    }
    console.log(
      JSON.stringify({
        retainedRecords: records,
        reservedForRun: 100,
        recordLimit: 1000,
        schemas: schemas.length,
      }),
    );
  } finally {
    await client.end();
  }
  const files = fs
    .readdirSync(path.join(ROOT, 'apps/api/v1-test'))
    .filter((x) => x.endsWith('.test.cjs'))
    .sort();
  if (!files.length) throw new Error('No native test files');
  const result = spawnSync(
    path.join(c.nodeBin, 'node'),
    ['--test', ...files.map((x) => path.join(ROOT, 'apps/api/v1-test', x))],
    {
      cwd: ROOT,
      env: { ...nativeEnv(), NODE_ENV: 'production' },
      stdio: 'inherit',
      timeout: 60000,
    },
  );
  return result.status ?? 1;
}
if (require.main === module)
  run()
    .then((code) => {
      process.exitCode = code;
    })
    .catch(() => {
      console.error(
        'Native PostgreSQL tests refused; inspect owned identity, retained-record budget and compiled test inputs.',
      );
      process.exitCode = 1;
    });
module.exports = { run };
