'use strict';

const {
  S3Client,
  CreateBucketCommand,
  PutBucketPolicyCommand,
} = require('@aws-sdk/client-s3');
const { setTimeout: delay } = require('node:timers/promises');

// These credentials and this bucket belong only to the disposable E2E server.
const bucket = 'isntgram-e2e';
const client = new S3Client({
  endpoint: 'http://127.0.0.1:9000',
  region: 'us-east-1',
  forcePathStyle: true,
  maxAttempts: 1,
  credentials: {
    accessKeyId: 'e2e-access',
    secretAccessKey: 'e2e-secret-for-disposable-tests',
  },
});

async function main() {
  for (let attempt = 0; ; attempt++) {
    try {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
      break;
    } catch (error) {
      if (error.name === 'BucketAlreadyOwnedByYou') break;
      if (attempt >= 59) throw error;
      await delay(1000);
    }
  }
  await client.send(
    new PutBucketPolicyCommand({
      Bucket: bucket,
      Policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: '*',
            Action: 's3:GetObject',
            Resource: `arn:aws:s3:::${bucket}/published/*`,
          },
        ],
      }),
    }),
  );
  console.log('Disposable E2E photo storage ready.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.destroy());
