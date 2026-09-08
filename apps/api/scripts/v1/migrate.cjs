'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  ROOT,
  STATE,
  load,
  statePath,
  appEnvironment,
  args,
} = require('./config.cjs');
const { connect } = require('./preflight.cjs');

async function migrate(target) {
  if (!['app', 'test'].includes(target))
    throw new Error('Only app or test migrations are supported');
  const c = load();
  const client = await connect(c, target);
  try {
    const result = await client.query(
      "SELECT name FROM pg_available_extensions WHERE name='pgcrypto'",
    );
    if (result.rowCount !== 1)
      throw new Error('Required native extension missing');
  } finally {
    await client.end();
  }
  const output = path.join(
    STATE,
    'logs',
    `migrate-${target}-${Date.now()}.log`,
  );
  statePath(output);
  const fd = fs.openSync(output, 'wx', 0o600);
  let result;
  try {
    result = spawnSync(
      path.join(c.nodeBin, 'node'),
      [path.join(ROOT, 'apps/api/dist/run-migrations.js')],
      {
        cwd: ROOT,
        env: appEnvironment(c, target),
        stdio: ['ignore', fd, fd],
        timeout: 60000,
      },
    );
  } finally {
    fs.closeSync(fd);
  }
  if (result.status !== 0)
    throw new Error('Migration failed; retained private log');
  const verified = await connect(c, target);
  try {
    const rows = (
      await verified.query(
        'SELECT timestamp::text, name FROM migrations ORDER BY timestamp',
      )
    ).rows;
    const source = fs
      .readdirSync(path.join(ROOT, 'apps/api/src/migrations'))
      .filter((n) => /^\d+-.*\.ts$/.test(n));
    const expected = source.map((n) => n.split('-')[0]).sort();
    if (
      JSON.stringify(rows.map((r) => r.timestamp).sort()) !==
      JSON.stringify(expected)
    )
      throw new Error('Migration inventory differs');
    return { target, database: c[target + 'Database'], migrations: rows };
  } finally {
    await verified.end();
  }
}
if (require.main === module)
  Promise.resolve()
    .then(() => migrate(args(1)[0]))
    .then((x) => console.log(JSON.stringify(x)))
    .catch(() => {
      console.error(
        'V1 migration refused or failed. Inspect retained private logs; no down/reset attempted.',
      );
      process.exitCode = 1;
    });
module.exports = { migrate };
