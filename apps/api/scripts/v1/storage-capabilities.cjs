'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  CreateBucketCommand,
  GetBucketPolicyCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const config = require('./config.cjs');
const storage = require('./storage.cjs');

const REQUEST_TIMEOUT_MS = 5_000;
const PRESIGN_EXPIRES_SECONDS = 300;
const TEST_OBJECT_BYTES = 1_024;
const TEST_OBJECT_COUNT = 3;
const CAPABILITY_RECEIPT_DIR = path.join(config.STATE, 'evidence');

function fail(message) {
  throw new Error(`V1 storage capability refused: ${message}`);
}

function capabilityReceiptPath() {
  return path.join(
    CAPABILITY_RECEIPT_DIR,
    `storage-capabilities-${crypto.randomUUID()}.json`,
  );
}

function policyDocument(bucket) {
  if (bucket !== 'isntgram-v1-media') fail('unexpected bucket');
  return {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'PublicReadPublishedOnly',
        Effect: 'Allow',
        Principal: '*',
        Action: 's3:GetObject',
        Resource: `arn:aws:s3:::${bucket}/published/*`,
      },
    ],
  };
}

function canonicalPolicy(value) {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    fail('bucket policy is not an object');
  const sort = (item) => {
    if (Array.isArray(item)) return item.map(sort);
    if (!item || typeof item !== 'object') return item;
    return Object.fromEntries(
      Object.keys(item)
        .sort()
        .map((key) => [key, sort(item[key])]),
    );
  };
  return JSON.stringify(sort(parsed));
}

function policyMatches(bucket, value) {
  try {
    return canonicalPolicy(value) === canonicalPolicy(policyDocument(bucket));
  } catch {
    return false;
  }
}

function clientOptions(c, credentials) {
  if (c.storageEndpoint !== 'http://127.0.0.1:48333')
    fail('unexpected storage endpoint');
  return {
    region: 'us-east-1',
    endpoint: c.storageEndpoint,
    forcePathStyle: true,
    credentials,
    maxAttempts: 1,
    // AWS SDK v3 otherwise calculates a flexible checksum for supported PUTs.
    // The browser direct-PUT proof sends the exact signed 1 KiB body instead.
    requestChecksumCalculation: 'WHEN_REQUIRED',
  };
}

function createClient(c, credentials = adminCredentials(c), Client = S3Client) {
  return new Client(clientOptions(c, credentials));
}

function adminCredentials(c) {
  return {
    accessKeyId: c.secrets.S3_ACCESS_KEY_ID,
    secretAccessKey: c.secrets.S3_SECRET_ACCESS_KEY,
  };
}

function invalidCredentials() {
  return {
    accessKeyId: 'invalid-v1-storage-key',
    secretAccessKey: 'invalid-v1-storage-secret',
  };
}

function publicObjectUrl(c, key) {
  if (!/^(?:pending|published)\/[a-z0-9-]+\.txt$/.test(key))
    fail('unexpected capability object key');
  return `${c.storageEndpoint}/${c.bucket}/${key}`;
}

function isMissing(error) {
  return (
    error?.$metadata?.httpStatusCode === 404 ||
    ['NotFound', 'NoSuchBucket', 'NoSuchBucketPolicy', 'NoSuchKey'].includes(
      error?.name,
    )
  );
}

function isDenied(error) {
  return (
    error?.$metadata?.httpStatusCode === 401 ||
    error?.$metadata?.httpStatusCode === 403 ||
    ['AccessDenied', 'InvalidAccessKeyId', 'SignatureDoesNotMatch'].includes(
      error?.name,
    )
  );
}

async function send(client, command) {
  return client.send(command, {
    abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

async function fetchBounded(fetchImpl, url, options = {}) {
  return fetchImpl(url, {
    ...options,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

async function expectDenied(action, label) {
  try {
    await action();
  } catch (error) {
    if (isDenied(error)) return;
    throw error;
  }
  fail(`${label} unexpectedly succeeded`);
}

async function expectMissing(action, label) {
  try {
    await action();
  } catch (error) {
    if (isMissing(error)) return;
    throw error;
  }
  fail(`${label} unexpectedly exists`);
}

function assertExactBytes(actual, expected, label) {
  if (!Buffer.from(actual).equals(expected)) fail(`${label} bytes differ`);
}

async function assertExactObject(admin, bucket, key, body, label) {
  const head = await send(
    admin,
    new HeadObjectCommand({ Bucket: bucket, Key: key }),
  );
  if (head.ContentLength !== body.length || head.ContentType !== 'text/plain')
    fail(`${label} HEAD differs`);
  const object = await send(
    admin,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  assertExactBytes(
    await object.Body.transformToByteArray(),
    body,
    `credentialed ${label} GET`,
  );
}

async function expectHttpDenied(action, label) {
  const response = await action();
  if (response.status === 401 || response.status === 403)
    return response.status;
  fail(`${label} returned HTTP ${response.status}`);
}

function exactBucket(c) {
  if (c.bucket !== 'isntgram-v1-media') fail('unexpected bucket');
  return c.bucket;
}

async function bootstrapBucket(admin, c) {
  const bucket = exactBucket(c);
  let created = false;
  try {
    await send(admin, new HeadBucketCommand({ Bucket: bucket }));
  } catch (error) {
    if (!isMissing(error)) throw error;
    await send(admin, new CreateBucketCommand({ Bucket: bucket }));
    created = true;
  }

  let policyInstalled = false;
  try {
    const current = await send(
      admin,
      new GetBucketPolicyCommand({ Bucket: bucket }),
    );
    if (!policyMatches(bucket, current.Policy))
      fail('existing bucket policy differs');
  } catch (error) {
    if (!isMissing(error)) throw error;
    await send(
      admin,
      new PutBucketPolicyCommand({
        Bucket: bucket,
        Policy: JSON.stringify(policyDocument(bucket)),
      }),
    );
    policyInstalled = true;
  }
  return { created, policyInstalled };
}

async function requireExactBucketPolicy(admin, c) {
  const bucket = exactBucket(c);
  await send(admin, new HeadBucketCommand({ Bucket: bucket }));
  const current = await send(
    admin,
    new GetBucketPolicyCommand({ Bucket: bucket }),
  );
  if (!policyMatches(bucket, current.Policy)) fail('bucket policy differs');
}

function capabilityKeys() {
  const run = crypto.randomUUID();
  return Object.freeze({
    pending: `pending/${run}.txt`,
    published: `published/${run}.txt`,
    pendingNegative: `pending/${crypto.randomUUID()}.txt`,
    publishedNegative: `published/${crypto.randomUUID()}.txt`,
    browserAllowed: `pending/${crypto.randomUUID()}.txt`,
    browserForeign: `pending/${crypto.randomUUID()}.txt`,
  });
}

function assertBudget(bounds) {
  if (!bounds || !Number.isSafeInteger(bounds.privateStateBytes))
    fail('storage resource bounds are incomplete');
  if (TEST_OBJECT_BYTES * TEST_OBJECT_COUNT > bounds.privateStateBytes)
    fail('capability fixture exceeds private-state bound');
}

function sanitizedResult(c, qualification, keys, bucketState) {
  return {
    endpoint: c.storageEndpoint,
    bucket: c.bucket,
    qualification,
    bucketState,
    objects: {
      pending: keys.pending,
      published: keys.published,
      bytesEach: TEST_OBJECT_BYTES,
      retainedByCapabilityRun: 2,
      retainedMaximumWithBrowserProof: TEST_OBJECT_COUNT,
    },
    timeoutMs: REQUEST_TIMEOUT_MS,
    maxAttempts: 1,
  };
}

function safeFailure(error) {
  const result = {};
  if (/^[A-Za-z][A-Za-z0-9_]{0,80}$/.test(error?.name || ''))
    result.name = error.name;
  if (/^[A-Za-z0-9_.-]{1,80}$/.test(error?.code || ''))
    result.code = error.code;
  const httpStatus = error?.$metadata?.httpStatusCode;
  if (Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599)
    result.httpStatus = httpStatus;
  return result;
}

function browserGrantSummary(c, grants) {
  return {
    origin: c.webOrigin,
    allowedKey: grants.allowed.key,
    foreignKey: grants.foreign.key,
    contentType: grants.allowed.contentType,
    bytes: Buffer.byteLength(grants.allowed.body),
    expiresInSeconds: PRESIGN_EXPIRES_SECONDS,
  };
}

function writePrivateReceipt(value, file, flag = 'wx') {
  if (typeof file !== 'string') fail('private receipt path is required');
  config.statePath(file);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const parent = fs.statSync(path.dirname(file));
  if (!parent.isDirectory() || (parent.mode & 0o777) !== 0o700)
    fail('private receipt directory differs');
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', {
    mode: 0o600,
    flag,
  });
  if ((fs.statSync(file).mode & 0o777) !== 0o600)
    fail('private receipt permissions differ');
}

function createPrivateJournal(file = capabilityReceiptPath()) {
  let written = false;
  return {
    record(value) {
      writePrivateReceipt(value, file, written ? 'w' : 'wx');
      written = true;
    },
  };
}

async function proveCapabilities({
  admin,
  invalid,
  c,
  fetchImpl,
  presign,
  keys,
}) {
  const bucket = exactBucket(c);
  const body = Buffer.alloc(TEST_OBJECT_BYTES, 'v');
  const pendingPut = new PutObjectCommand({
    Bucket: bucket,
    Key: keys.pending,
    ContentType: 'text/plain',
    ContentLength: body.length,
  });
  const pendingPutUrl = await presign(admin, pendingPut, {
    expiresIn: PRESIGN_EXPIRES_SECONDS,
  });
  const pendingPutResponse = await fetchBounded(fetchImpl, pendingPutUrl, {
    method: 'PUT',
    headers: { 'content-type': 'text/plain' },
    body,
  });
  if (!pendingPutResponse.ok) fail('presigned pending PUT failed');

  await assertExactObject(admin, bucket, keys.pending, body, 'pending');

  await send(
    admin,
    new PutObjectCommand({
      Bucket: bucket,
      Key: keys.published,
      Body: body,
      ContentType: 'text/plain',
      ContentLength: body.length,
    }),
  );
  await assertExactObject(admin, bucket, keys.published, body, 'published');

  const pendingHeadUrl = await presign(
    admin,
    new HeadObjectCommand({ Bucket: bucket, Key: keys.pending }),
    { expiresIn: PRESIGN_EXPIRES_SECONDS },
  );
  const pendingGetUrl = await presign(
    admin,
    new GetObjectCommand({ Bucket: bucket, Key: keys.pending }),
    { expiresIn: PRESIGN_EXPIRES_SECONDS },
  );
  if (!(await fetchBounded(fetchImpl, pendingHeadUrl, { method: 'HEAD' })).ok)
    fail('presigned pending HEAD failed');
  const pendingGetResponse = await fetchBounded(fetchImpl, pendingGetUrl);
  if (!pendingGetResponse.ok) fail('presigned pending GET failed');
  assertExactBytes(
    await pendingGetResponse.arrayBuffer(),
    body,
    'presigned pending GET',
  );

  const anonymousPublished = await fetchBounded(
    fetchImpl,
    publicObjectUrl(c, keys.published),
  );
  if (!anonymousPublished.ok) fail('anonymous published GET failed');
  assertExactBytes(
    await anonymousPublished.arrayBuffer(),
    body,
    'anonymous published GET',
  );
  await expectHttpDenied(
    () => fetchBounded(fetchImpl, publicObjectUrl(c, keys.pending)),
    'anonymous pending GET',
  );
  await expectHttpDenied(
    () => fetchBounded(fetchImpl, `${c.storageEndpoint}/${bucket}?list-type=2`),
    'anonymous list',
  );
  await expectHttpDenied(
    () =>
      fetchBounded(fetchImpl, publicObjectUrl(c, keys.pendingNegative), {
        method: 'PUT',
        headers: { 'content-type': 'text/plain' },
        body,
      }),
    'anonymous pending PUT',
  );
  await expectHttpDenied(
    () =>
      fetchBounded(fetchImpl, publicObjectUrl(c, keys.publishedNegative), {
        method: 'PUT',
        headers: { 'content-type': 'text/plain' },
        body,
      }),
    'anonymous published PUT',
  );
  await expectMissing(
    () =>
      send(
        admin,
        new HeadObjectCommand({ Bucket: bucket, Key: keys.pendingNegative }),
      ),
    'negative delete key',
  );
  await expectHttpDenied(
    () =>
      fetchBounded(fetchImpl, publicObjectUrl(c, keys.pendingNegative), {
        method: 'DELETE',
      }),
    'anonymous DELETE',
  );
  await expectMissing(
    () =>
      send(
        admin,
        new HeadObjectCommand({ Bucket: bucket, Key: keys.pendingNegative }),
      ),
    'negative delete key after denied delete',
  );

  await expectDenied(
    () => send(invalid, new ListObjectsV2Command({ Bucket: bucket })),
    'invalid credential list',
  );
  await expectDenied(
    () =>
      send(
        invalid,
        new PutObjectCommand({
          Bucket: bucket,
          Key: keys.pendingNegative,
          Body: body,
          ContentType: 'text/plain',
          ContentLength: body.length,
        }),
      ),
    'invalid credential write',
  );

  // Browser grants are generated last, after all capability checks, and point
  // at distinct never-written pending keys. The primary keeps these private.
  await expectMissing(
    () =>
      send(
        admin,
        new HeadObjectCommand({ Bucket: bucket, Key: keys.browserAllowed }),
      ),
    'browser allowed key',
  );
  await expectMissing(
    () =>
      send(
        admin,
        new HeadObjectCommand({ Bucket: bucket, Key: keys.browserForeign }),
      ),
    'browser foreign key',
  );
  const browserGrants = Object.freeze({
    allowed: Object.freeze({
      url: await presign(
        admin,
        new PutObjectCommand({
          Bucket: bucket,
          Key: keys.browserAllowed,
          ContentType: 'text/plain',
          ContentLength: body.length,
        }),
        { expiresIn: PRESIGN_EXPIRES_SECONDS },
      ),
      key: keys.browserAllowed,
      body: body.toString('utf8'),
      contentType: 'text/plain',
    }),
    foreign: Object.freeze({
      url: await presign(
        admin,
        new PutObjectCommand({
          Bucket: bucket,
          Key: keys.browserForeign,
          ContentType: 'text/plain',
          ContentLength: body.length,
        }),
        { expiresIn: PRESIGN_EXPIRES_SECONDS },
      ),
      key: keys.browserForeign,
      body: body.toString('utf8'),
      contentType: 'text/plain',
    }),
  });
  return { keys, browserGrants };
}

async function run(mode, dependencies = {}) {
  if (!['bootstrap', 'prove'].includes(mode)) fail('unexpected mode');
  const deps = {
    load: config.load,
    completeQualification: storage.completeQualification,
    assertResources: storage.assertResources,
    resourceBounds: storage.resourceBounds,
    storagePaths: storage.storagePaths,
    S3Client,
    presign: getSignedUrl,
    fetch: globalThis.fetch,
    record: async () => {},
    browserProof: null,
    ...dependencies,
  };
  if (typeof deps.fetch !== 'function') fail('fetch is unavailable');
  const c = deps.load();
  const qualification = deps.completeQualification(c);
  deps.assertResources(deps.storagePaths());
  const bounds = deps.resourceBounds();
  assertBudget(bounds);
  const keys = capabilityKeys();
  let stage = 'allocated';
  let browserEvidence;
  await deps.record({
    stage,
    mode,
    endpoint: c.storageEndpoint,
    bucket: c.bucket,
    keys,
    bytesEach: TEST_OBJECT_BYTES,
    retainedMaximum: TEST_OBJECT_COUNT,
  });
  const admin = createClient(c, adminCredentials(c), deps.S3Client);
  const invalid = createClient(c, invalidCredentials(), deps.S3Client);
  try {
    const bucketState =
      mode === 'bootstrap'
        ? await bootstrapBucket(admin, c)
        : {
            created: false,
            policyInstalled: false,
          };
    stage = 'bucket-policy-readback';
    await requireExactBucketPolicy(admin, c);
    await deps.record({ stage, mode, keys, bucketState });
    stage = 'capability-proof';
    const proof = await proveCapabilities({
      admin,
      invalid,
      c,
      fetchImpl: deps.fetch,
      presign: deps.presign,
      keys,
    });
    const result = sanitizedResult(c, qualification, proof.keys, bucketState);
    let browser;
    if (deps.browserProof) {
      stage = 'browser-qualification';
      deps.completeQualification(c);
      await deps.record({ stage, mode, keys });
      stage = 'browser-proof';
      const browserClient = createClient(c, adminCredentials(c), deps.S3Client);
      try {
        browser = await deps.browserProof(
          c,
          proof.browserGrants,
          browserClient,
          async (evidence) => {
            browserEvidence = evidence;
            await deps.record({
              stage: 'browser-observation',
              mode,
              keys,
              browserEvidence,
            });
          },
        );
      } finally {
        browserClient.destroy?.();
      }
    }
    if (browser !== undefined) result.browser = browser;
    stage = 'passed';
    await deps.record({
      stage,
      result,
      browserGrant: browserGrantSummary(c, proof.browserGrants),
    });
    return { result, browserGrants: proof.browserGrants };
  } catch (error) {
    await deps.record({
      stage: 'failed',
      failureStage: stage,
      mode,
      keys,
      failure: safeFailure(error),
      ...(browserEvidence === undefined ? {} : { browserEvidence }),
    });
    throw error;
  } finally {
    admin.destroy?.();
    invalid.destroy?.();
  }
}

if (require.main === module)
  Promise.resolve()
    .then(async () => {
      const journal = createPrivateJournal();
      const { result } = await run(config.args(1)[0], {
        record: (entry) => journal.record(entry),
        browserProof: async (c, browserGrants, browserClient, record) =>
          require('./storage-browser.cjs').proveBrowserCors(
            c,
            browserGrants,
            browserClient,
            record,
          ),
      });
      console.log(JSON.stringify(result));
    })
    .catch(() => {
      console.error(
        'V1 storage capability refused; inspect private receipt and guarded provider state. No secrets displayed.',
      );
      process.exitCode = 1;
    });

module.exports = {
  REQUEST_TIMEOUT_MS,
  PRESIGN_EXPIRES_SECONDS,
  TEST_OBJECT_BYTES,
  TEST_OBJECT_COUNT,
  CAPABILITY_RECEIPT_DIR,
  capabilityReceiptPath,
  policyDocument,
  canonicalPolicy,
  policyMatches,
  clientOptions,
  createClient,
  publicObjectUrl,
  bootstrapBucket,
  requireExactBucketPolicy,
  proveCapabilities,
  sanitizedResult,
  safeFailure,
  browserGrantSummary,
  writePrivateReceipt,
  createPrivateJournal,
  run,
};
