'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  TEST_OBJECT_BYTES,
  TEST_OBJECT_COUNT,
  policyDocument,
  canonicalPolicy,
  policyMatches,
  clientOptions,
  publicObjectUrl,
  safeFailure,
  browserGrantSummary,
  run,
} = require('./storage-capabilities.cjs');

const config = Object.freeze({
  storageEndpoint: 'http://127.0.0.1:48333',
  bucket: 'isntgram-v1-media',
  webOrigin: 'http://127.0.0.1:4320',
  secrets: Object.freeze({
    S3_ACCESS_KEY_ID: 'a'.repeat(32),
    S3_SECRET_ACCESS_KEY: 'b'.repeat(32),
  }),
});

test('the bucket policy is exactly one anonymous published GET allow', () => {
  assert.deepEqual(policyDocument(config.bucket), {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'PublicReadPublishedOnly',
        Effect: 'Allow',
        Principal: '*',
        Action: 's3:GetObject',
        Resource: 'arn:aws:s3:::isntgram-v1-media/published/*',
      },
    ],
  });
  assert.equal(
    policyMatches(
      config.bucket,
      '{"Statement":[{"Resource":"arn:aws:s3:::isntgram-v1-media/published/*","Action":"s3:GetObject","Principal":"*","Effect":"Allow","Sid":"PublicReadPublishedOnly"}],"Version":"2012-10-17"}',
    ),
    true,
  );
  assert.equal(
    policyMatches(config.bucket, {
      ...policyDocument(config.bucket),
      Statement: [
        {
          ...policyDocument(config.bucket).Statement[0],
          Resource: 'arn:aws:s3:::isntgram-v1-media/*',
        },
      ],
    }),
    false,
  );
  assert.throws(() => canonicalPolicy('not JSON'));
});

test('SDK clients use the exact path-style endpoint and one attempt', () => {
  assert.deepEqual(
    clientOptions(config, { accessKeyId: 'x', secretAccessKey: 'y' }),
    {
      region: 'us-east-1',
      endpoint: 'http://127.0.0.1:48333',
      forcePathStyle: true,
      credentials: { accessKeyId: 'x', secretAccessKey: 'y' },
      maxAttempts: 1,
      requestChecksumCalculation: 'WHEN_REQUIRED',
    },
  );
  assert.throws(
    () =>
      clientOptions({ ...config, storageEndpoint: 'http://0.0.0.0:48333' }, {}),
    /unexpected storage endpoint/,
  );
});

test('public object URLs only admit unique pending or published capability keys', () => {
  assert.equal(
    publicObjectUrl(
      config,
      'published/123e4567-e89b-12d3-a456-426614174000.txt',
    ),
    'http://127.0.0.1:48333/isntgram-v1-media/published/123e4567-e89b-12d3-a456-426614174000.txt',
  );
  assert.throws(() => publicObjectUrl(config, 'published/not-a-test-key.png'));
  assert.throws(() => publicObjectUrl(config, 'outside/key.txt'));
  assert.equal(TEST_OBJECT_BYTES * TEST_OBJECT_COUNT, 3072);
});

test('journal diagnostics and browser grant summaries exclude raw URLs and bodies', () => {
  const error = Object.assign(new Error('presigned URL must not escape'), {
    code: 'AccessDenied',
    $metadata: { httpStatusCode: 403 },
  });
  assert.deepEqual(safeFailure(error), {
    name: 'Error',
    code: 'AccessDenied',
    httpStatus: 403,
  });
  assert.deepEqual(
    browserGrantSummary(config, {
      allowed: {
        url: 'http://credential.example.invalid/?X-Amz-Signature=secret',
        key: 'pending/allowed.txt',
        body: 'v'.repeat(1024),
        contentType: 'text/plain',
      },
      foreign: {
        url: 'http://credential.example.invalid/?X-Amz-Signature=secret',
        key: 'pending/foreign.txt',
        body: 'v'.repeat(1024),
        contentType: 'text/plain',
      },
    }),
    {
      origin: 'http://127.0.0.1:4320',
      allowedKey: 'pending/allowed.txt',
      foreignKey: 'pending/foreign.txt',
      contentType: 'text/plain',
      bytes: 1024,
      expiresInSeconds: 300,
    },
  );
});

test('qualification refusal occurs before resource checks or S3 client construction', async () => {
  let resourceChecked = false;
  let clientConstructed = false;
  await assert.rejects(
    run('prove', {
      load: () => config,
      completeQualification: () => {
        throw new Error('not qualified');
      },
      assertResources: () => {
        resourceChecked = true;
      },
      resourceBounds: () => ({ privateStateBytes: 3 * 1024 ** 3 }),
      storagePaths: () => ({ root: '/private/state' }),
      S3Client: class {
        constructor() {
          clientConstructed = true;
        }
      },
      fetch: async () => {
        throw new Error('must not fetch');
      },
    }),
    /not qualified/,
  );
  assert.equal(resourceChecked, false);
  assert.equal(clientConstructed, false);
});
