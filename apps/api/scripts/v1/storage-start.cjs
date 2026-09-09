'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { load, statePath, args, native, STATE } = require('./config.cjs');
const {
  storagePaths,
  verifyInstalled,
  serverArgs,
  launchPreflight,
} = require('./storage.cjs');

// A finite foreground launch. execve replaces this process; it creates no daemon or PID registry.
function start() {
  args(0);
  const c = load();
  const paths = storagePaths();
  const installed = verifyInstalled(paths);
  launchPreflight(c, paths);
  if (typeof process.execve !== 'function')
    throw new Error('Native foreground exec is unavailable');
  const commandArgs = serverArgs(c, paths);
  statePath(paths.logsServer);
  const launchMs = Date.now();
  const log = path.join(paths.logsServer, `weed-${launchMs}.log`);
  statePath(log);
  process.umask(0o077);
  // Seaweed startup may print credentials. Both output streams go only to a new private log.
  const stdout = fs.openSync(log, 'wx', 0o600);
  const stderr = fs.openSync(log, 'a', 0o600);
  const evidence = statePath(path.join(STATE, 'evidence'));
  const evidenceStat = fs.lstatSync(evidence);
  if (!evidenceStat.isDirectory() || (evidenceStat.mode & 0o777) !== 0o700)
    throw new Error('Private evidence directory differs');
  const receipt = statePath(
    path.join(evidence, `storage-launch-${crypto.randomUUID()}.json`),
  );
  const launch = {
    at: new Date(launchMs).toISOString(),
    pid: process.pid,
    started: native('/bin/ps', [
      '-p',
      String(process.pid),
      '-o',
      'lstart=',
    ]).trim(),
    executable: installed.executable,
    log,
    binarySha256: require('./storage.cjs').BINARY_SHA256,
  };
  fs.writeFileSync(receipt, JSON.stringify(launch, null, 2) + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
  console.log(
    JSON.stringify({
      pid: process.pid,
      executable: installed.executable,
      log,
      foreground: true,
      launchReceipt: receipt,
    }),
  );
  fs.closeSync(1);
  if (fs.openSync(log, 'a') !== 1)
    throw new Error('Could not bind private stdout');
  fs.closeSync(2);
  if (fs.openSync(log, 'a') !== 2)
    throw new Error('Could not bind private stderr');
  fs.closeSync(stdout);
  fs.closeSync(stderr);
  process.chdir(paths.root);
  process.execve(installed.executable, [installed.executable, ...commandArgs], {
    PATH: `${c.nodeBin}:/usr/bin:/bin:/usr/sbin:/sbin`,
    HOME: paths.homeServer,
    TMPDIR: paths.dataServer,
    LC_ALL: 'C',
    LANG: 'C',
  });
}
if (require.main === module) {
  try {
    start();
  } catch {
    console.error(
      'Storage foreground launch refused. Inspect private state and logs; no automatic repair attempted.',
    );
    process.exitCode = 1;
  }
}
module.exports = { start };
