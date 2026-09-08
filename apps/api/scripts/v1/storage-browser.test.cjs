'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const { chromium } = require('@playwright/test');
const {
  loadOriginDocument,
  assertForeignPreflight,
} = require('./storage-browser.cjs');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const API_ORIGIN = 'http://127.0.0.1:4321';
const ALLOWED_ORIGIN = 'http://127.0.0.1:4320';
const FOREIGN_ORIGIN = 'http://127.0.0.1:4322';
const PROBE_PATH = '/__isntgram_read_only_probe__';

test('foreign enforcement requires real 403 denial and browser rejection, independent of optional CDP diagnostics', () => {
  const rejected = { completed: false, errorName: 'TypeError' };
  assert.doesNotThrow(() =>
    assertForeignPreflight(rejected, [{ status: 403, allowOrigin: null }]),
  );
  assert.throws(() => assertForeignPreflight(rejected, []));
  assert.throws(() =>
    assertForeignPreflight(rejected, [{ status: 200, allowOrigin: null }]),
  );
  assert.throws(() =>
    assertForeignPreflight(rejected, [
      { status: 403, allowOrigin: FOREIGN_ORIGIN },
    ]),
  );
  assert.throws(() =>
    assertForeignPreflight({ completed: true, status: 200 }, [
      { status: 403, allowOrigin: null },
    ]),
  );
});

function listenExclusive(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(4321, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

async function grantLoopbackPermission(context, page, origin) {
  const cdp = await context.newCDPSession(page);
  const { targetInfo } = await cdp.send('Target.getTargetInfo');
  assert.ok(targetInfo.browserContextId, 'an ephemeral context is required');
  await cdp.send('Browser.setPermission', {
    permission: { name: 'loopback-network' },
    setting: 'granted',
    origin,
    browserContextId: targetInfo.browserContextId,
  });
  await cdp.send('Network.enable');
  return cdp;
}

async function browserReadOnlyProbe(browser, origin) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    const page = await context.newPage();
    const cdp = await grantLoopbackPermission(context, page, origin);
    const requests = new Map();
    const preflights = [];
    const extraInfo = [];
    const failures = [];
    cdp.on('Network.requestWillBeSent', (event) => {
      const requestUrl = new URL(event.request.url);
      if (
        requestUrl.origin !== API_ORIGIN ||
        requestUrl.pathname !== PROBE_PATH
      )
        return;
      requests.set(event.requestId, { method: event.request.method });
    });
    cdp.on('Network.responseReceived', (event) => {
      const request = requests.get(event.requestId);
      if (request?.method !== 'OPTIONS') return;
      preflights.push({
        status: event.response.status,
        statusText: event.response.statusText,
      });
    });
    cdp.on('Network.responseReceivedExtraInfo', (event) => {
      extraInfo.push({
        requestId: event.requestId,
        status: event.statusCode,
        headers: Object.fromEntries(
          Object.entries(event.headers)
            .filter(([key]) => /^access-control-/i.test(key))
            .map(([key, value]) => [key.toLowerCase(), value]),
        ),
      });
    });
    cdp.on('Network.loadingFailed', (event) => {
      if (!event.corsErrorStatus?.corsError) return;
      failures.push(event.corsErrorStatus.corsError);
    });
    await loadOriginDocument(page, `${origin}/__storage_browser_regression__`);
    const result = await page.evaluate(async (url) => {
      try {
        const response = await fetch(url, {
          headers: { 'X-Isntgram-Read-Only-Probe': '1' },
          signal: AbortSignal.timeout(10_000),
        });
        return {
          completed: true,
          status: response.status,
          body: await response.text(),
        };
      } catch (error) {
        return { completed: false, errorName: error.name };
      }
    }, `${API_ORIGIN}${PROBE_PATH}`);
    // CDP response metadata can arrive after fetch settles. Wait for the
    // evidence we assert below before closing the ephemeral context.
    const deadline = performance.now() + 5_000;
    while (
      !extraInfo.some(
        (event) => requests.get(event.requestId)?.method === 'OPTIONS',
      ) ||
      preflights.length === 0 ||
      (!result.completed && failures.length === 0)
    ) {
      assert.ok(
        performance.now() < deadline,
        'timed out waiting for preflight network evidence',
      );
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    return {
      result,
      failures,
      preflights,
      preflightExtra: extraInfo
        .filter((event) => requests.get(event.requestId)?.method === 'OPTIONS')
        .map(({ requestId: _requestId, ...event }) => event),
    };
  } finally {
    await context.close();
  }
}

test(
  'origin bootstrap routing is removed before the browser performs a real API CORS preflight',
  { timeout: 30_000 },
  async () => {
    assert.ok(require('node:fs').statSync(CHROME).isFile());
    const calls = {
      allowedOptions: 0,
      foreignOptions: 0,
      allowedGet: 0,
      foreignGet: 0,
    };
    const server = http.createServer((request, response) => {
      const origin = request.headers.origin;
      if (request.url !== PROBE_PATH) {
        response.writeHead(404).end();
        return;
      }
      if (request.method === 'OPTIONS') {
        if (origin === ALLOWED_ORIGIN) {
          calls.allowedOptions += 1;
          response
            .writeHead(200, {
              'access-control-allow-origin': ALLOWED_ORIGIN,
              'access-control-allow-methods': 'GET',
              'access-control-allow-headers': 'X-Isntgram-Read-Only-Probe',
            })
            .end();
          return;
        }
        if (origin === FOREIGN_ORIGIN) {
          calls.foreignOptions += 1;
          response.writeHead(403).end();
          return;
        }
      }
      if (request.method === 'GET' && origin === ALLOWED_ORIGIN) {
        calls.allowedGet += 1;
        response
          .writeHead(200, { 'access-control-allow-origin': ALLOWED_ORIGIN })
          .end('allowed read-only probe');
        return;
      }
      if (request.method === 'GET' && origin === FOREIGN_ORIGIN) {
        calls.foreignGet += 1;
        response.writeHead(500).end('foreign GET must remain blocked');
        return;
      }
      response.writeHead(405).end();
    });
    let browser;
    try {
      await listenExclusive(server);
      browser = await chromium.launch({
        executablePath: CHROME,
        headless: true,
        timeout: 15_000,
      });
      const allowed = await browserReadOnlyProbe(browser, ALLOWED_ORIGIN);
      assert.deepEqual(allowed.result, {
        completed: true,
        status: 200,
        body: 'allowed read-only probe',
      });
      assert.ok(
        allowed.preflights.some((preflight) => preflight.status === 200),
      );
      assert.ok(
        allowed.preflightExtra.some(
          (preflight) =>
            preflight.status === 200 &&
            preflight.headers['access-control-allow-origin'] === ALLOWED_ORIGIN,
        ),
      );

      const foreign = await browserReadOnlyProbe(browser, FOREIGN_ORIGIN);
      assert.deepEqual(foreign.result, {
        completed: false,
        errorName: 'TypeError',
      });
      assert.ok(
        foreign.preflights.some((preflight) => preflight.status === 403),
        `foreign preflight status must be 403, got ${JSON.stringify({
          statuses: foreign.preflights.map((preflight) => preflight.status),
          reasons: foreign.failures,
        })}`,
      );
      assert.ok(
        foreign.preflightExtra.some(
          (preflight) =>
            preflight.status === 403 &&
            !Object.hasOwn(preflight.headers, 'access-control-allow-origin'),
        ),
        `foreign preflight headers must omit ACAO, got ${JSON.stringify({
          statuses: foreign.preflightExtra.map((preflight) => preflight.status),
          reasons: foreign.failures,
        })}`,
      );
      assert.ok(
        foreign.failures.some((error) =>
          [
            'PreflightInvalidStatus',
            'MissingAllowOriginHeader',
            'PreflightMissingAllowOriginHeader',
          ].includes(error),
        ),
        `foreign failure must be a CORS preflight failure, got ${foreign.failures.join(',')}`,
      );
      assert.equal(
        foreign.failures.some((error) =>
          /LocalNetworkAccess|PrivateNetwork/i.test(error),
        ),
        false,
      );
      assert.deepEqual(calls, {
        allowedOptions: 1,
        foreignOptions: 1,
        allowedGet: 1,
        foreignGet: 0,
      });
    } finally {
      await browser?.close();
      await closeServer(server).catch((error) => {
        if (error.code !== 'ERR_SERVER_NOT_RUNNING') throw error;
      });
    }
  },
);
