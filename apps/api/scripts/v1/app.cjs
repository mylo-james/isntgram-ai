'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const config = require('./config.cjs');
const preflight = require('./preflight.cjs');
const storage = require('./storage.cjs');
const fixture = require('./fixture.cjs');

function environment(c, service, retainedTestRecords) {
  if (!['api', 'web'].includes(service)) throw new Error('Unknown application service');
  if (!Number.isSafeInteger(retainedTestRecords) || retainedTestRecords < 0 || retainedTestRecords >= 1000)
    throw new Error('Invalid retained test record count');
  const all = config.appEnvironment(c);
  const keys = service === 'api'
    ? ['DATABASE_URL', 'DATABASE_SSL', 'JWT_SECRET', 'HOST', 'PORT', 'CORS_ORIGIN',
      'DEMO_ENABLED', 'DEMO_TTL_HOURS', 'DEMO_CONTENT_SOURCE', 'AI_PROVIDER',
      'S3_ENDPOINT', 'S3_PUBLIC_BASE_URL', 'S3_PRESIGN_ENDPOINT', 'S3_DISPLAY_BASE_URL', 'S3_BUCKET', 'S3_REGION',
      'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'MEDIA_ALLOWED_HOSTS', 'MEDIA_MAX_UPLOAD_BYTES']
    : ['AUTH_SECRET', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL', 'NEXT_PUBLIC_APP_URL',
      'INTERNAL_API_URL', 'NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_MEDIA_HOSTS',
      'NEXT_PUBLIC_DEMO_ENABLED', 'NEXT_PUBLIC_DEMO_CONTENT_SOURCE'];
  return {
    ...config.nativeEnv(), ...Object.fromEntries(keys.filter((key) => all[key] !== undefined).map((key) => [key, all[key]])),
    NODE_ENV: service === 'api' ? 'production' : 'development',
    ...(service === 'api' ? { DEMO_RECORD_LIMIT: String(1000 - retainedTestRecords),
      METRICS_ENABLED: 'false', REQUEST_LOGGING: 'true' } : { ISNTGRAM_LOCAL_MEDIA: 'true' }),
  };
}

async function start(service) {
  if (!['api', 'web'].includes(service)) throw new Error('Use api or web');
  const c = config.load();
  const port = service === 'api' ? 4321 : 4320;
  preflight.freePorts([port, 4322]);
  preflight.capacity();
  const native = preflight.running(c);
  const storageNative = storage.completeQualification(c);
  const testRecords = await fixture.retainedTestRecords(c);
  const env = environment(c, service, testRecords);
  let fixtureProof;
  if (service === 'api') {
    // Verify and compile before the native watch process exists. Never compile beside watch.
    fixtureProof = await fixture.run('verify');
  } else {
    const response = await fetch(`${c.apiOrigin}/api/ready`, { signal: AbortSignal.timeout(5000), redirect: 'error' });
    const body = await response.json();
    if (response.status !== 200 || body.status !== 'ok' || body.database !== 'connected')
      throw new Error('API is not semantically ready');
  }
  preflight.freePorts([port, 4322]);
  if (typeof process.execve !== 'function') throw new Error('Native foreground exec unavailable');
  const cwd = path.join(config.ROOT, 'apps', service);
  const entry = path.join(cwd, service === 'api'
    ? 'node_modules/@nestjs/cli/bin/nest.js' : 'node_modules/next/dist/bin/next');
  const command = service === 'api' ? ['start', '--watch']
    : ['dev', '--hostname', c.host, '--port', String(port)];
  const id = crypto.randomUUID();
  const receipt = config.statePath(path.join(config.STATE, 'evidence', `${service}-launch-${id}.json`));
  const log = config.statePath(path.join(config.STATE, 'evidence', `${service}-${id}.log`));
  const fd = fs.openSync(log, 'wx', 0o600);
  fs.closeSync(fd);
  const launch = { at: new Date().toISOString(), service, pid: process.pid,
    started: config.native('/bin/ps', ['-p', String(process.pid), '-o', 'lstart=']).trim(),
    cwd, executable: path.join(c.nodeBin, 'node'), entry, entrySha256: config.hashFile(entry),
    port, native, storageNative, retainedTestRecords: testRecords, demoEnabled: c.demoReady,
    environmentKeys: Object.keys(env).sort(), fixtureProof, log };
  fs.writeFileSync(receipt, JSON.stringify(launch, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  fs.writeSync(1, JSON.stringify({ service, pid: process.pid, launchReceipt: receipt, log, foreground: true }) + '\n');
  fs.closeSync(1);
  if (fs.openSync(log, 'a') !== 1) throw new Error('Private stdout unavailable');
  fs.closeSync(2);
  if (fs.openSync(log, 'a') !== 2) throw new Error('Private stderr unavailable');
  process.chdir(cwd);
  process.execve(launch.executable, [launch.executable, entry, ...command], env);
}

if (require.main === module)
  Promise.resolve().then(() => start(config.args(1)[0])).catch(() => {
    console.error('Application launch refused. Inspect retained private evidence; no automatic repair attempted.');
    process.exitCode = 1;
  });
module.exports = { environment, start };
