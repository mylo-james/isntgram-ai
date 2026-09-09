'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const {
  FIXED,
  STATE,
  load,
  native,
  statePath,
  database,
  args,
} = require('./config.cjs');
const fail = (message) => {
  throw new Error(`V1 preflight refused: ${message}`);
};

function listeners(port, execute = native) {
  try {
    const out = execute('/usr/sbin/lsof', [
      '-nP',
      `-iTCP:${port}`,
      '-sTCP:LISTEN',
      '-Fpn',
    ]);
    return out
      .split('\n')
      .filter((x) => /^p\d+$/.test(x))
      .map((x) => Number(x.slice(1)));
  } catch (e) {
    if (
      e.status === 1 &&
      !String(e.stdout || '').trim() &&
      !String(e.stderr || '').trim()
    )
      return [];
    fail('listener inspection unavailable');
  }
}
function freePorts(ports, execute = native) {
  for (const port of ports)
    if (listeners(port, execute).length) fail(`port ${port} is occupied`);
}
function noApiBuildProcesses(execute = native) {
  let output;
  try {
    output = execute('/usr/sbin/lsof', ['-a', '-c', 'node', '-d', 'cwd', '-Fpn']);
  } catch (error) {
    if (error.status === 1 && !String(error.stdout || '').trim() && !String(error.stderr || '').trim()) return;
    fail('API build/watch process inspection unavailable');
  }
  // Nest watch and its compiler use this cwd even while no HTTP listener exists.
  // A matching cwd refuses a competing build; it never authorizes a signal.
  if (output.split('\n').includes(`n${FIXED.root}/apps/api`))
    fail('API build/watch process is active');
}
function capacity() {
  const disk = fs.statfsSync(STATE);
  if (disk.bavail * disk.bsize < 5 * 1024 ** 3)
    fail('less than 5 GiB available');
}
function control(c, execute = native, allowUnrecorded = false) {
  statePath(c.data);
  if (fs.readFileSync(path.join(c.data, 'PG_VERSION'), 'utf8').trim() !== '16')
    fail('data version differs');
  statePath(path.join(c.data, 'global/pg_control'));
  const out = execute(path.join(c.pgBin, 'pg_controldata'), [c.data]);
  const systemId = out.match(/Database system identifier:\s*(\d+)/)?.[1];
  const state = out.match(/Database cluster state:\s*([^\n]+)/)?.[1]?.trim();
  if (!systemId || !state || (!allowUnrecorded && c.systemId !== systemId))
    fail('native cluster identity differs');
  return { systemId, state, data: c.data };
}
function running(c, execute = native) {
  const identity = control(c, execute);
  const file = path.join(c.data, 'postmaster.pid');
  statePath(file);
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const pid = Number(lines[0]);
  if (
    !Number.isSafeInteger(pid) ||
    pid < 2 ||
    lines[1] !== c.data ||
    lines[3] !== String(c.port) ||
    lines[4] !== '' ||
    lines[5] !== c.host
  )
    fail('postmaster identity differs');
  if (
    !execute(path.join(c.pgBin, 'pg_ctl'), ['-D', c.data, 'status']).includes(
      `PID: ${pid})`,
    )
  )
    fail('pg_ctl identity differs');
  const pids = listeners(c.port, execute);
  if (pids.length !== 1 || pids[0] !== pid) fail('listener identity differs');
  const executable = fs.realpathSync(path.join(c.pgBin, 'postgres'));
  if (
    !execute('/usr/sbin/lsof', ['-a', '-p', String(pid), '-d', 'txt', '-Fn'])
      .split('\n')
      .includes(`n${executable}`) ||
    !execute('/usr/sbin/lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'])
      .split('\n')
      .includes(`n${c.data}`) ||
    execute('/bin/ps', ['-p', String(pid), '-o', 'uid=']).trim() !==
      String(process.getuid())
  )
    fail('process owner/executable/cwd differs');
  return {
    ...identity,
    pid,
    executable,
    started: execute('/bin/ps', ['-p', String(pid), '-o', 'lstart=']).trim(),
    nativeStarted: lines[2],
  };
}
function stopped(c) {
  freePorts([c.port]);
  if (fs.existsSync(path.join(c.data, 'postmaster.pid')))
    fail('postmaster file still present');
  const identity = control(c);
  if (identity.state !== 'shut down') fail('cluster not cleanly stopped');
  return identity;
}
async function connect(c, target) {
  running(c); // Native identity is checked before even opening a database connection.
  const options = database(c, target);
  const client = new Client(options);
  try {
    await client.connect();
    const { rows } = await client.query(
      "SELECT current_database() AS db, current_user AS role, current_setting('port') AS port, current_setting('cluster_name') AS cluster, current_setting('listen_addresses') AS listen, current_setting('server_version_num') AS version",
    );
    const r = rows[0];
    if (
      r.db !== options.database ||
      r.role !== options.user ||
      r.port !== String(c.port) ||
      r.cluster !== c.cluster ||
      r.listen !== c.host ||
      r.version !== '160015'
    )
      fail('SQL target differs');
    return client;
  } catch (e) {
    await client.end().catch(() => {});
    throw e;
  }
}
async function preflight(mode) {
  if (!['bootstrap', 'stopped', 'running'].includes(mode))
    fail('unexpected mode');
  const c = load();
  statePath(c.data);
  if (mode === 'bootstrap') {
    if (fs.existsSync(c.data) || c.systemId !== null)
      fail('initialization target already exists');
    capacity();
    freePorts([c.port, 4320, 4321, 4322]);
    return { mode, root: c.root, port: c.port };
  }
  const identity = mode === 'stopped' ? stopped(c) : running(c);
  if (mode === 'running') {
    for (const target of ['app', 'test']) {
      const client = await connect(c, target);
      await client.end();
    }
  }
  return {
    mode,
    root: c.root,
    native: identity,
    databases: [c.appDatabase, c.testDatabase],
  };
}
if (require.main === module)
  Promise.resolve()
    .then(() => preflight(args(1)[0]))
    .then((x) => console.log(JSON.stringify(x)))
    .catch(() => {
      console.error(
        'V1 preflight refused; inspect owned configuration and native identity. No mutation attempted.',
      );
      process.exitCode = 1;
    });
module.exports = {
  listeners,
  freePorts,
  noApiBuildProcesses,
  capacity,
  control,
  running,
  stopped,
  connect,
  preflight,
  FIXED,
};
