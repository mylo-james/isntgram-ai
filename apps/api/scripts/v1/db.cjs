'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {
  STATE,
  load,
  native,
  statePath,
  saveIdentity,
  args,
} = require('./config.cjs');
const {
  preflight,
  control,
  running,
  stopped,
  connect,
} = require('./preflight.cjs');

async function bootstrapDatabases(c) {
  const client = await connect(c, 'admin');
  try {
    const { rows } = await client.query(
      'SELECT system_identifier::text AS id FROM pg_control_system()',
    );
    if (rows[0].id !== c.systemId)
      throw new Error('SQL native identity differs');
    for (const target of ['app', 'test']) {
      const role = c[target + 'Role'];
      const db = c[target + 'Database'];
      const present = await client.query(
        'SELECT 1 FROM pg_roles WHERE rolname=$1',
        [role],
      );
      // Bootstrap is one-time. Partial state is retained and requires inspection instead of resetting passwords.
      if (present.rowCount)
        throw new Error('Role already exists; inspect partial bootstrap');
      const password =
        c.secrets[`ISNTGRAM_V1_${target.toUpperCase()}_DB_PASSWORD`];
      // Identifiers and password alphabet are validated by config; server statement logging is disabled.
      await client.query(
        `CREATE ROLE "${role}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${password}'`,
      );
      await client.query(`CREATE DATABASE "${db}" OWNER "${role}"`);
      await client.query(`REVOKE CONNECT ON DATABASE "${db}" FROM PUBLIC`);
      await client.query(`GRANT CONNECT ON DATABASE "${db}" TO "${role}"`);
    }
    await client.query('REVOKE CONNECT ON DATABASE postgres FROM PUBLIC');
    await client.query('REVOKE CONNECT ON DATABASE template1 FROM PUBLIC');
  } finally {
    await client.end().catch(() => {});
  }
}
async function run(action) {
  if (!['init', 'start', 'stop', 'status', 'provision'].includes(action))
    throw new Error('Unexpected db action');
  let c = load();
  const binary = (name) => path.join(c.pgBin, name);
  if (action === 'init') {
    await preflight('bootstrap');
    const passwordFile = path.join(STATE, 'initdb-password');
    statePath(passwordFile);
    fs.writeFileSync(
      passwordFile,
      c.secrets.ISNTGRAM_V1_ADMIN_DB_PASSWORD + '\n',
      { mode: 0o600, flag: 'wx' },
    );
    native(
      binary('initdb'),
      [
        '-D',
        c.data,
        '--username',
        c.adminRole,
        '--encoding=UTF8',
        '--locale=C',
        '--auth-host=scram-sha-256',
        '--auth-local=scram-sha-256',
        '--pwfile',
        passwordFile,
      ],
      { timeout: 30000 },
    );
    const identity = control(c, native, true);
    c = saveIdentity(identity.systemId);
    return { action, native: stopped(c) };
  }
  if (action === 'start') {
    const before = stopped(c);
    const logdir = path.join(STATE, 'logs');
    statePath(logdir);
    fs.mkdirSync(logdir, { recursive: true, mode: 0o700 });
    const log = path.join(logdir, 'postgres.log');
    statePath(log);
    const fd = fs.openSync(log, 'a', 0o600);
    fs.closeSync(fd);
    native(
      binary('pg_ctl'),
      [
        '-D',
        c.data,
        '-l',
        log,
        '-w',
        '-t',
        '30',
        'start',
        '-o',
        `-c cluster_name=${c.cluster} -c listen_addresses=${c.host} -c port=${c.port} -c unix_socket_directories='' -c log_statement=none -c log_min_error_statement=panic -c log_parameter_max_length=0 -c log_parameter_max_length_on_error=0`,
      ],
      { timeout: 35000 },
    );
    const after = running(c);
    if (after.systemId !== before.systemId) throw new Error('Identity changed');
    return { action, native: after };
  }
  if (action === 'provision') {
    await bootstrapDatabases(c);
    return preflight('running');
  }
  if (action === 'stop') {
    const before = running(c);
    native(
      binary('pg_ctl'),
      ['-D', c.data, '-w', '-t', '30', 'stop', '-m', 'fast'],
      { timeout: 35000 },
    );
    const after = stopped(c);
    if (after.systemId !== before.systemId) throw new Error('Identity changed');
    return { action, native: after };
  }
  return fs.existsSync(path.join(c.data, 'postmaster.pid'))
    ? preflight('running')
    : preflight('stopped');
}
if (require.main === module)
  Promise.resolve()
    .then(() => run(args(1)[0]))
    .then((x) => console.log(JSON.stringify(x)))
    .catch(() => {
      console.error(
        'V1 database action failed. Retained state requires inspection; no forced stop or cleanup attempted.',
      );
      process.exitCode = 1;
    });
module.exports = { run, bootstrapDatabases };
