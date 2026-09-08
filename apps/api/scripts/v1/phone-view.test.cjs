'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { privateOnly, occupied, routes, ownedState, assertState, commands, stopRoutes } = require('./phone-view.cjs');
const baseline = {
  TCP: { 8443: { HTTPS: true }, 8444: { HTTPS: true } },
  Web: {
    'example.test:8443': { Handlers: { '/': { Proxy: 'http://127.0.0.1:9000' } } },
    'example.test:8444': { Handlers: { '/': { Proxy: 'http://127.0.0.1:9001' } } },
  },
  Foreground: { existing: { TCP: { 443: { HTTPS: true } }, Web: { 'example.test:443': { Handlers: { '/': { Proxy: 'http://127.0.0.1:9002' } } } } } },
};
const runtime = { webOrigin: 'http://127.0.0.1:4320', storageEndpoint: 'http://127.0.0.1:48333', phoneView: {
  webOrigin: 'https://example.test:8445', s3Origin: 'https://example.test:8446', serveWebPort: 8445, serveS3Port: 8446,
} };
const status = { BackendState: 'Running', Self: { Online: true, DNSName: 'example.test.' } };

test('route authority must match the current online native identity and exact local targets', () => {
  const selected = routes(runtime, status);
  assert.deepEqual(selected.map(r => r.target), ['http://127.0.0.1:4320', 'http://127.0.0.1:48333']);
  for (const change of [{ webOrigin: 'http://0.0.0.0:4320' }, { storageEndpoint: 'http://remote.test' },
    { phoneView: { ...runtime.phoneView, webOrigin: 'https://foreign.test:8445' } },
    { phoneView: { ...runtime.phoneView, serveWebPort: 8443 } },
    { phoneView: { ...runtime.phoneView, serveS3Port: 70000 } }])
    assert.throws(() => routes({ ...runtime, ...change }, status));
  assert.throws(() => routes(runtime, { ...status, BackendState: 'Stopped' }));
  assert.throws(() => routes(runtime, { ...status, Self: { ...status.Self, Online: false } }));
});

test('occupied native foreground ports are preserved along with both prior HTTPS routes', () => {
  assert.equal(occupied(baseline, 443), true);
  assert.equal(occupied(baseline, 8443), true);
  assert.equal(occupied(baseline, 8444), true);
  assert.equal(occupied(baseline, 8445), false);
  const selected = routes(runtime, status);
  const complete = ownedState(baseline, selected);
  assertState(complete, baseline, selected);
  assert.deepEqual(complete.Foreground, baseline.Foreground);
  assert.deepEqual(complete.Web['example.test:8444'], baseline.Web['example.test:8444']);
  assert.equal(Object.hasOwn(baseline.TCP, 8445), false);
});

test('partial native application is distinguishable from foreign route or baseline drift before any next mutation', () => {
  const selected = routes(runtime, status);
  assertState(ownedState(baseline, selected.slice(0, 1)), baseline, selected.slice(0, 1));
  assert.throws(() => assertState(ownedState(baseline, selected.slice(0, 1)), baseline, selected));
  const changed = ownedState(baseline, selected);
  changed.Web['example.test:8445'].Handlers['/'].Proxy = 'http://127.0.0.1:9000';
  assert.throws(() => assertState(changed, baseline, selected));
  const unrelated = ownedState(baseline, selected);
  unrelated.TCP[8444] = { TCPForward: '127.0.0.1:9001' };
  assert.throws(() => assertState(unrelated, baseline, selected));
});

test('Funnel anywhere in the selected native state refuses private operation', () => {
  privateOnly(baseline);
  assert.throws(() => privateOnly({ ...baseline, AllowFunnel: { 'example.test:8443': true } }));
  assert.throws(() => privateOnly({ Foreground: { existing: { AllowFunnel: { 'example.test:443': true } } } }));
});

test('native lifecycle commands address one exact HTTPS target without reset or global configuration replacement', () => {
  const [route] = routes(runtime, status);
  assert.deepEqual(commands(route), ['serve', '--bg', '--https=8445', 'http://127.0.0.1:4320']);
  assert.deepEqual(commands(route, true), ['serve', '--bg', '--https=8445', 'http://127.0.0.1:4320', 'off']);
});

test('a failed second native removal retains partial stop evidence without retry or touching baseline routes', () => {
  const selected = routes(runtime, status);
  let current = ownedState(baseline, selected);
  const writes = [];
  const calls = [];
  const failure = new Error('sensitive native output must not enter a receipt');
  assert.throws(() => stopRoutes({ id: 'retained-start', baseline, routes: selected }, {
    read: () => structuredClone(current),
    write: (name, value) => { writes.push({ name, value }); return name; },
    execute: (_cli, args) => {
      calls.push(args);
      if (calls.length === 2) throw failure;
      current = ownedState(baseline, selected.slice(0, 1));
    },
  }), error => error === failure);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], commands(selected[1], true));
  assert.deepEqual(calls[1], commands(selected[0], true));
  assert.equal(writes.length, 2);
  const partial = writes[1];
  assert.match(partial.name, /-incomplete$/);
  assert.equal(partial.value.startId, 'retained-start');
  assert.deepEqual(partial.value.remaining, selected.slice(0, 1));
  assert.deepEqual(partial.value.state, current);
  assert.equal(partial.value.stateAvailable, true);
  assert.equal(JSON.stringify(writes).includes('sensitive native output'), false);
  assert.deepEqual(current.Foreground, baseline.Foreground);
  assert.deepEqual(current.Web['example.test:8443'], baseline.Web['example.test:8443']);
});
