'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('@playwright/test');
const { HeadObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { completeQualification } = require('./storage.cjs');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ALLOWED_ORIGIN = 'http://127.0.0.1:4320';
const FOREIGN_ORIGIN = 'http://127.0.0.1:4322';

function assertForeignPreflight(fetchResult, preflights) {
  assert.equal(fetchResult.completed, false);
  assert.equal(fetchResult.errorName, 'TypeError');
  assert.ok(
    preflights.some((p) => p.status === 403 && p.allowOrigin === null),
    'The real provider must reject the foreign preflight',
  );
  assert.ok(preflights.every((p) => p.allowOrigin === null));
}

async function loadOriginDocument(page, documentUrl) {
  await page.route(documentUrl, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Isntgram storage capability</title><main>Local browser CORS proof</main>',
    }),
  );
  await page.goto(documentUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 10000,
  });
  await page.unroute(documentUrl);
  assert.equal(page.url(), documentUrl);
  assert.equal(await page.title(), 'Isntgram storage capability');
}

// Route only the bootstrap document, then remove interception before S3 traffic.
// Playwright otherwise auto-fulfills CORS preflights, even for unmatched routes.
async function proveBrowserCors(c, grants, client, record = async () => {}) {
  completeQualification(c);
  assert.equal(c.webOrigin, ALLOWED_ORIGIN);
  assert.equal(c.storageEndpoint, 'http://127.0.0.1:48333');
  assert.ok(fs.statSync(CHROME).isFile());
  for (const grant of [grants.allowed, grants.foreign]) {
    const url = new URL(grant.url);
    assert.equal(url.origin, c.storageEndpoint);
    assert.equal(url.pathname, `/${c.bucket}/${grant.key}`);
    assert.ok(grant.key.startsWith('pending/'));
    assert.ok(Buffer.byteLength(grant.body) <= 1024);
    assert.equal(grant.contentType, 'text/plain');
  }
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    timeout: 15000,
  });
  const results = [];
  try {
    for (const [name, origin] of [
      ['allowed', ALLOWED_ORIGIN],
      ['foreign', FOREIGN_ORIGIN],
    ]) {
      const grant = grants[name];
      const context = await browser.newContext({ serviceWorkers: 'block' });
      try {
        const page = await context.newPage();
        const documentUrl = `${origin}/__isntgram_storage_capability__`;
        const cdp = await context.newCDPSession(page);
        const { targetInfo } = await cdp.send('Target.getTargetInfo');
        assert.ok(
          targetInfo.browserContextId,
          'An ephemeral context is required',
        );
        // Chrome 151 separates loopback access from local-network-access. Grant
        // only this origin in this disposable context; CORS remains enforced.
        await cdp.send('Browser.setPermission', {
          permission: { name: 'loopback-network' },
          setting: 'granted',
          origin,
          browserContextId: targetInfo.browserContextId,
        });
        await cdp.send('Network.enable');
        const requests = new Map();
        const preflights = [];
        const failures = [];
        cdp.on('Network.loadingFailed', (event) => {
          if (!requests.has(event.requestId)) return;
          failures.push({
            errorText: event.errorText,
            corsError: event.corsErrorStatus?.corsError ?? null,
          });
        });
        cdp.on('Network.requestWillBeSent', (event) => {
          const url = new URL(event.request.url);
          if (
            url.origin === c.storageEndpoint &&
            url.pathname === `/${c.bucket}/${grant.key}`
          )
            requests.set(event.requestId, {
              method: event.request.method,
              path: url.pathname,
            });
        });
        cdp.on('Network.responseReceived', (event) => {
          const request = requests.get(event.requestId);
          if (request?.method !== 'OPTIONS') return;
          const headers = Object.fromEntries(
            Object.entries(event.response.headers).map(([key, value]) => [
              key.toLowerCase(),
              value,
            ]),
          );
          preflights.push({
            status: event.response.status,
            allowOrigin: headers['access-control-allow-origin'] ?? null,
            allowMethods: headers['access-control-allow-methods'] ?? null,
            allowHeaders: headers['access-control-allow-headers'] ?? null,
          });
        });
        await loadOriginDocument(page, documentUrl);
        const loopbackPermission = await page.evaluate(
          async () =>
            (await navigator.permissions.query({ name: 'loopback-network' }))
              .state,
        );
        assert.equal(loopbackPermission, 'granted');
        const fetchResult = await page.evaluate(async (input) => {
          try {
            const response = await fetch(input.url, {
              method: 'PUT',
              headers: { 'Content-Type': input.contentType },
              body: input.body,
              signal: AbortSignal.timeout(10000),
            });
            return {
              completed: true,
              status: response.status,
              ok: response.ok,
            };
          } catch (error) {
            return { completed: false, errorName: error.name };
          }
        }, grant);
        const observed = {
          origin,
          documentUrl,
          harnessOnly: true,
          fetchResult,
          preflights,
          failures,
          loopbackPermission: {
            state: loopbackPermission,
            scope: 'ephemeral exact origin',
          },
          objectVerified: false,
        };
        results.push(observed);
        // Persist the safe network evidence before assertions can end this run.
        await record(
          JSON.parse(
            JSON.stringify({ browserVersion: browser.version(), results }),
          ),
        );
        assert.ok(
          preflights.length > 0,
          'Browser preflight evidence is required',
        );
        if (name === 'allowed') {
          assert.equal(fetchResult.ok, true);
          assert.ok(preflights.some((p) => p.allowOrigin === ALLOWED_ORIGIN));
          const head = await client.send(
            new HeadObjectCommand({ Bucket: c.bucket, Key: grant.key }),
            { abortSignal: AbortSignal.timeout(5000) },
          );
          assert.equal(head.ContentLength, Buffer.byteLength(grant.body));
          assert.equal(head.ContentType, grant.contentType);
          const object = await client.send(
            new GetObjectCommand({ Bucket: c.bucket, Key: grant.key }),
            { abortSignal: AbortSignal.timeout(5000) },
          );
          assert.equal(await object.Body.transformToString(), grant.body);
        } else {
          // The real 403, rejected fetch and absent object prove enforcement.
          // A separate CDP loadingFailed event is useful optional diagnostics.
          assertForeignPreflight(fetchResult, preflights);
          await assert.rejects(
            client.send(
              new HeadObjectCommand({ Bucket: c.bucket, Key: grant.key }),
              { abortSignal: AbortSignal.timeout(5000) },
            ),
            (error) => error.$metadata?.httpStatusCode === 404,
          );
        }
        observed.objectVerified = true;
        await record(
          JSON.parse(
            JSON.stringify({ browserVersion: browser.version(), results }),
          ),
        );
      } finally {
        await context.close();
      }
    }
    completeQualification(c);
    return {
      browser: 'installed Google Chrome via Playwright 1.55.1',
      browserVersion: browser.version(),
      browserPlugin: 'not available',
      appUiVerified: false,
      results,
    };
  } finally {
    await browser.close();
  }
}

module.exports = {
  proveBrowserCors,
  loadOriginDocument,
  assertForeignPreflight,
};
