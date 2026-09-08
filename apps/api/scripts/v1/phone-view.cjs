'use strict';
// Finite app-owned native Serve commands. No daemon, polling loop or process registry.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const config = require('./config.cjs');
const preflight = require('./preflight.cjs');
const storage = require('./storage.cjs');
const CLI = '/usr/local/bin/tailscale';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const refuse = () => { throw new Error('Private phone view refused; retained evidence requires inspection.'); };

function serve(execute = config.native) {
  return JSON.parse(execute(CLI, ['serve', 'status', '--json'], { timeout: 15000 }));
}
function privateOnly(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) refuse();
  if (Object.values(state.AllowFunnel || {}).some(Boolean)) refuse();
  for (const child of Object.values(state.Foreground || {})) privateOnly(child);
}
function occupied(state, port) {
  return Boolean(state.TCP?.[port]) || Object.keys(state.Web || {}).some(key => key.endsWith(`:${port}`)) ||
    Object.values(state.Foreground || {}).some(child => occupied(child, port));
}
function routes(c, status) {
  const v = c.phoneView;
  if (!v || status.BackendState !== 'Running' || status.Self?.Online !== true) refuse();
  const host = status.Self.DNSName?.replace(/\.$/, '');
  if (!host || host !== host.toLowerCase()) refuse();
  return [[v.webOrigin, v.serveWebPort, c.webOrigin], [v.s3Origin, v.serveS3Port, c.storageEndpoint]]
    .map(([origin, port, target]) => {
      if (!Number.isSafeInteger(port) || port < 1024 || port > 65535 || port === 8443 ||
        origin !== `https://${host}:${port}` || !['http://127.0.0.1:4320', 'http://127.0.0.1:48333'].includes(target)) refuse();
      return { port, hostPort: `${host}:${port}`, target };
    });
}
function ownedState(baseline, selected) {
  const expected = structuredClone(baseline);
  expected.TCP ||= {};
  expected.Web ||= {};
  for (const route of selected) {
    expected.TCP[route.port] = { HTTPS: true };
    expected.Web[route.hostPort] = { Handlers: { '/': { Proxy: route.target } } };
  }
  return expected;
}
function assertState(actual, baseline, selected) {
  privateOnly(actual);
  if (!isDeepStrictEqual(actual, ownedState(baseline, selected))) refuse();
}
function commands(route, stop = false) {
  return ['serve', '--bg', `--https=${route.port}`, route.target, ...(stop ? ['off'] : [])];
}
function receipt(name, value) {
  const file = config.statePath(path.join(config.STATE, 'evidence', `${name}.json`));
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return file;
}
function identity(execute = config.native) {
  const status = JSON.parse(execute(CLI, ['status', '--json'], { timeout: 15000 }));
  const version = execute(CLI, ['version'], { timeout: 15000 }).trim();
  return { status, version, executableSha256: config.hashFile(fs.realpathSync(CLI)) };
}
async function ready(c) {
  preflight.running(c);
  storage.completeQualification(c);
  const pids = preflight.listeners(4320);
  if (pids.length !== 1) refuse();
  const pid = String(pids[0]);
  if (config.native('/bin/ps', ['-p', pid, '-o', 'uid=']).trim() !== String(process.getuid()) ||
    !config.native('/usr/sbin/lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn']).split('\n').includes(`n${config.ROOT}/apps/web`) ||
    !config.native('/usr/sbin/lsof', ['-a', '-p', pid, '-d', 'txt', '-Fn']).split('\n').includes(`n${fs.realpathSync(path.join(c.nodeBin, 'node'))}`)) refuse();
  const response = await fetch(`${c.apiOrigin}/api/ready`, { signal: AbortSignal.timeout(5000), redirect: 'error' });
  const body = await response.json();
  if (response.status !== 200 || body.status !== 'ok' || body.database !== 'connected') refuse();
}
async function start(c) {
  const native = identity();
  const selected = routes(c, native.status);
  if (selected[0].port === selected[1].port) refuse();
  const baseline = serve();
  privateOnly(baseline);
  if (selected.some(route => occupied(baseline, route.port))) refuse();
  preflight.freePorts(selected.map(route => route.port));
  await ready(c);
  const id = crypto.randomUUID();
  const intent = { id, at: new Date().toISOString(), baseline, routes: selected,
    executableSha256: native.executableSha256, version: native.version,
    configSha256: config.hashFile(config.FILE), sourceSha256: config.hashFile(__filename) };
  const intentFile = receipt(`phone-start-${id}`, intent);
  const applied = [];
  try {
    for (const route of selected) {
      assertState(serve(), baseline, applied);
      // Native stdout can contain tailnet identities, so it never reaches the public output.
      config.native(CLI, commands(route), { timeout: 20000 });
      applied.push(route);
      assertState(serve(), baseline, applied);
      receipt(`phone-start-${id}-step-${applied.length}`, { at: new Date().toISOString(), intentFile, applied, state: serve() });
    }
    return { intentId: id, receipt: receipt(`phone-start-${id}-complete`, { at: new Date().toISOString(), intentFile, state: serve() }), ports: selected.map(route => route.port) };
  } catch {
    let state;
    try { state = serve(); } catch { /* Preserve the intent when native inspection is unavailable. */ }
    receipt(`phone-start-${id}-incomplete`, { at: new Date().toISOString(), intentFile, applied, state, reason: 'native_step_incomplete_no_automatic_retry' });
    refuse();
  }
}
function stop(c, id) {
  if (!UUID.test(id || '')) refuse();
  const file = config.statePath(path.join(config.STATE, 'evidence', `phone-start-${id}.json`));
  config.privateFile(file);
  const intent = JSON.parse(fs.readFileSync(file, 'utf8'));
  const native = identity();
  const selected = routes(c, native.status);
  if (intent.id !== id || !isDeepStrictEqual(intent.routes, selected) || intent.executableSha256 !== native.executableSha256) refuse();
  return stopRoutes(intent, { read: serve, execute: config.native, write: receipt });
}
function stopRoutes(intent, { read, execute, write }) {
  const selected = intent.routes;
  const state = read();
  const remaining = selected.filter(route => occupied(state, route.port));
  assertState(state, intent.baseline, remaining);
  const stopId = crypto.randomUUID();
  write(`phone-stop-${stopId}-intent`, { at: new Date().toISOString(), startId: intent.id, stopId, state });
  try {
    for (const route of [...remaining].reverse()) {
      assertState(read(), intent.baseline, remaining);
      execute(CLI, commands(route, true), { timeout: 20000 });
      remaining.splice(remaining.indexOf(route), 1);
      assertState(read(), intent.baseline, remaining);
    }
    return { receipt: write(`phone-stop-${stopId}-complete`, { at: new Date().toISOString(), startId: intent.id, stopId, state: read() }), stopped: true };
  } catch (error) {
    let observed;
    try { observed = read(); } catch { /* Preserve the original native failure. */ }
    write(`phone-stop-${stopId}-incomplete`, { at: new Date().toISOString(), startId: intent.id, stopId,
      remaining, state: observed, stateAvailable: Boolean(observed), reason: 'native_stop_incomplete_no_automatic_retry' });
    throw error;
  }
}
async function run() {
  const c = config.load();
  const [action, id, ...extra] = process.argv.slice(2);
  if (extra.length) refuse();
  if (action === 'start' && !id) return start(c);
  if (action === 'stop') return stop(c, id);
  if (action === 'inspect' && !id) {
    const native = identity();
    const state = serve();
    privateOnly(state);
    return { receipt: receipt(`phone-inspect-${crypto.randomUUID()}`, { at: new Date().toISOString(), state, native }), privateOnly: true };
  }
  refuse();
}
if (require.main === module) run().then(value => console.log(JSON.stringify(value))).catch(() => {
  console.error('Phone view refused. Inspect retained private evidence; no automatic retry or cleanup.');
  process.exitCode = 1;
});
module.exports = { privateOnly, occupied, routes, ownedState, assertState, commands, stopRoutes };
