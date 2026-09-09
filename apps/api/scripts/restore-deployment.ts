import { createDecipheriv, createHash } from 'crypto';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawn } from 'child_process';
import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

type Manifest = {
  source: {
    deployed: { sha: string; tree: string; configRevisionDigest: string };
    tool: { sha: string; tree: string; dirty: boolean };
  };
  migrations: Array<{ timestamp: number; name: string }>;
  database: { key: string; sha256: string; iv: string; tag: string };
  media: Array<{ key: string; sha256: string; contentType: string }>;
};
const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};
function output(command: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args);
    let out = '';
    let err = '';
    child.stdout.on('data', (x) => (out += x));
    child.stderr.on('data', (x) => (err += x));
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0
        ? resolve(out.trim())
        : reject(new Error(`${command} exited ${code}: ${err.trim()}`)),
    );
  });
}
const run = (command: string, args: string[]) =>
  output(command, args).then(() => undefined);
async function bodyBytes(body: unknown): Promise<Buffer> {
  if (!body || !(Symbol.asyncIterator in Object(body)))
    throw new Error('object body unavailable');
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>)
    chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
function normalizedDatabase(value: string) {
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol))
    throw new Error('restore requires PostgreSQL URLs');
  return `postgresql://${url.hostname.toLowerCase()}:${url.port || '5432'}${url.pathname.replace(/\/+$/, '') || '/'}`;
}
function publicBase(name: string) {
  const url = new URL(required(name));
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !['http:', 'https:'].includes(url.protocol)
  )
    throw new Error(`${name} must be a plain HTTP(S) URL`);
  return url.toString().replace(/\/$/, '');
}
function allowlist(name: string) {
  const values = required(name)
    .split(',')
    .map((x) => x.trim());
  if (!values.length || values.some((x) => !/^[a-f0-9]{64}$/.test(x)))
    throw new Error(`${name} must contain SHA-256 values`);
  return new Set(values);
}
function assertCompatible(manifest: Manifest) {
  if (!manifest.source?.deployed || !Array.isArray(manifest.migrations))
    throw new Error('snapshot lacks required source or schema metadata');
  const sha = required('RESTORE_EXPECTED_DEPLOYED_SHA');
  if (!/^[a-f0-9]{40}$/.test(sha) || manifest.source.deployed.sha !== sha)
    throw new Error('snapshot deployed source SHA is not approved');
  if (
    !allowlist('RESTORE_ALLOWED_CONFIG_REVISION_DIGESTS').has(
      manifest.source.deployed.configRevisionDigest,
    )
  )
    throw new Error('snapshot deployed configuration revision is not approved');
  const schema = createHash('sha256')
    .update(JSON.stringify(manifest.migrations))
    .digest('hex');
  if (!allowlist('RESTORE_ALLOWED_SCHEMA_DIGESTS').has(schema))
    throw new Error('snapshot schema is not approved');
}

async function main() {
  const prefix = required('RESTORE_SNAPSHOT_PREFIX').replace(/\/$/, '');
  const backupBucket = required('S3_BACKUP_BUCKET');
  const targetBucket = required('RESTORE_PUBLISHED_BUCKET');
  const targetDb = required('RESTORE_DATABASE_DIRECT_URL');
  const sourceDb = required('SOURCE_DATABASE_DIRECT_URL');
  const sourceBucket = required('SOURCE_PUBLISHED_BUCKET');
  const sourceBase = publicBase('SOURCE_PUBLIC_BASE_URL');
  const restoreBase = publicBase('RESTORE_PUBLIC_BASE_URL');
  if (
    normalizedDatabase(targetDb) === normalizedDatabase(sourceDb) ||
    targetBucket === sourceBucket ||
    sourceBase === restoreBase
  )
    throw new Error(
      'restore target must differ from source database, bucket, and public media URL',
    );
  const key = Buffer.from(required('BACKUP_ENCRYPTION_KEY_BASE64'), 'base64');
  if (key.length !== 32) throw new Error('invalid backup key');
  const s3 = new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    credentials: {
      accessKeyId: required('S3_ACCESS_KEY_ID'),
      secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
    },
  });
  try {
    if (
      (await output(process.env.PSQL_BIN || 'psql', [
        '--no-psqlrc',
        '--set',
        'ON_ERROR_STOP=1',
        '--dbname',
        targetDb,
        '-At',
        '-c',
        "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'",
      ])) !== '0'
    )
      throw new Error('restore target database must be empty before restore');
    if (
      ((
        await s3.send(
          new ListObjectsV2Command({ Bucket: targetBucket, MaxKeys: 1 }),
        )
      ).KeyCount ?? 0) !== 0
    )
      throw new Error(
        'restore target published bucket must be empty before restore',
      );
    const manifestBytes = await bodyBytes(
      (
        await s3.send(
          new GetObjectCommand({
            Bucket: backupBucket,
            Key: `${prefix}/manifest.json`,
          }),
        )
      ).Body,
    );
    const marker = (
      await bodyBytes(
        (
          await s3.send(
            new GetObjectCommand({
              Bucket: backupBucket,
              Key: `${prefix}/COMPLETED`,
            }),
          )
        ).Body,
      )
    ).toString();
    if (marker !== createHash('sha256').update(manifestBytes).digest('hex'))
      throw new Error('snapshot completion marker differs');
    const manifest = JSON.parse(manifestBytes.toString()) as Manifest;
    assertCompatible(manifest);
    const encrypted = await bodyBytes(
      (
        await s3.send(
          new GetObjectCommand({
            Bucket: backupBucket,
            Key: manifest.database.key,
          }),
        )
      ).Body,
    );
    if (
      createHash('sha256').update(encrypted).digest('hex') !==
      manifest.database.sha256
    )
      throw new Error('encrypted dump hash differs');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(manifest.database.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(manifest.database.tag, 'base64'));
    const directory = await mkdtemp(join(tmpdir(), 'isntgram-restore-'));
    const file = join(directory, 'restore.dump');
    await writeFile(
      file,
      Buffer.concat([decipher.update(encrypted), decipher.final()]),
    );
    try {
      await run(process.env.PG_RESTORE_BIN || 'pg_restore', [
        '--no-owner',
        '--no-privileges',
        '--single-transaction',
        '--exit-on-error',
        '--dbname',
        targetDb,
        file,
      ]);
      await run(process.env.PSQL_BIN || 'psql', [
        '--no-psqlrc',
        '--set',
        'ON_ERROR_STOP=1',
        '--dbname',
        targetDb,
        '--command',
        'DELETE FROM deployment_target',
      ]);
      await run(process.env.PSQL_BIN || 'psql', [
        '--no-psqlrc',
        '--set',
        'ON_ERROR_STOP=1',
        '--dbname',
        targetDb,
        '--command',
        'DELETE FROM "media_uploads" WHERE "ownerId" IN (SELECT id FROM "users" WHERE "isDemoUser" = true AND "isDemoSeed" = false AND "demoExpiresAt" IS NOT NULL AND "demoExpiresAt" < NOW()); DELETE FROM "users" WHERE "isDemoUser" = true AND "isDemoSeed" = false AND "demoExpiresAt" IS NOT NULL AND "demoExpiresAt" < NOW()',
      ]);
      const retained = new Set(
        (
          await output(process.env.PSQL_BIN || 'psql', [
            '--no-psqlrc',
            '--set',
            'ON_ERROR_STOP=1',
            '--dbname',
            targetDb,
            '-At',
            '-c',
            'SELECT "publishedKey" FROM "media_uploads" WHERE "publishedKey" IS NOT NULL AND ("postId" IS NOT NULL OR "profilePictureUserId" IS NOT NULL)',
          ])
        )
          .split('\n')
          .filter(Boolean),
      );
      for (const media of manifest.media) {
        if (!retained.has(media.key)) continue;
        const body = await bodyBytes(
          (
            await s3.send(
              new GetObjectCommand({
                Bucket: backupBucket,
                Key: `${prefix}/media/${media.key}`,
              }),
            )
          ).Body,
        );
        if (createHash('sha256').update(body).digest('hex') !== media.sha256)
          throw new Error(`media hash differs: ${media.key}`);
        await s3.send(
          new PutObjectCommand({
            Bucket: targetBucket,
            Key: media.key,
            Body: body,
            ContentType: media.contentType,
          }),
        );
        const check = await bodyBytes(
          (
            await s3.send(
              new GetObjectCommand({ Bucket: targetBucket, Key: media.key }),
            )
          ).Body,
        );
        if (createHash('sha256').update(check).digest('hex') !== media.sha256)
          throw new Error(`restored media hash differs: ${media.key}`);
      }
      // Rebase only retained non-seed visitor bindings. Seed/static URLs remain unchanged.
      const restoreSql = restoreBase.replace(/'/g, "''");
      await run(process.env.PSQL_BIN || 'psql', [
        '--no-psqlrc',
        '--set',
        'ON_ERROR_STOP=1',
        '--dbname',
        targetDb,
        '--command',
        `UPDATE "posts" p SET "mediaUrl" = '${restoreSql}' || '/' || m."publishedKey" FROM "media_uploads" m JOIN "users" u ON u.id = m."ownerId" WHERE m."postId" = p.id AND m."publishedKey" IS NOT NULL AND u."isDemoUser" = true AND u."isDemoSeed" = false; UPDATE "users" u SET "profilePictureUrl" = '${restoreSql}' || '/' || m."publishedKey" FROM "media_uploads" m WHERE m."profilePictureUserId" = u.id AND m."publishedKey" IS NOT NULL AND u."isDemoUser" = true AND u."isDemoSeed" = false`,
      ]);
      console.log(
        JSON.stringify({
          restored: true,
          quarantined: true,
          objects: retained.size,
          prefix,
        }),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  } finally {
    s3.destroy();
  }
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
