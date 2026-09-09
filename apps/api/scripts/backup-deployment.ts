import { createCipheriv, createHash, randomBytes } from 'crypto';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawn } from 'child_process';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import dataSource from '../ormconfig';
import { withMaintenanceLock } from '../src/common/deployment/maintenance-lock';

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}
function run(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)),
    );
  });
}
function commandOutput(command: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0
        ? resolve(stdout.trim())
        : reject(new Error(`${command} exited ${code}: ${stderr.trim()}`)),
    );
  });
}
async function bodyBytes(body: unknown): Promise<Buffer> {
  if (!body || !(Symbol.asyncIterator in Object(body)))
    throw new Error('backup object body unavailable');
  const chunks: Buffer[] = [];
  for await (const c of body as AsyncIterable<Uint8Array>)
    chunks.push(Buffer.from(c));
  return Buffer.concat(chunks);
}

async function main() {
  const env = required('DEPLOYMENT_ENV');
  const backupBucket = required('S3_BACKUP_BUCKET');
  const deployedSha = required('ISNTGRAM_DEPLOYED_SHA');
  if (!/^[a-f0-9]{40}$/.test(deployedSha))
    throw new Error(
      'ISNTGRAM_DEPLOYED_SHA must be a 40-character lowercase commit SHA',
    );
  await commandOutput('git', ['cat-file', '-e', `${deployedSha}^{commit}`]);
  const deployedTree = await commandOutput('git', [
    'rev-parse',
    `${deployedSha}^{tree}`,
  ]);
  const toolSha = await commandOutput('git', ['rev-parse', 'HEAD']);
  const toolTree = await commandOutput('git', ['rev-parse', 'HEAD^{tree}']);
  const expectedToolSha =
    process.env.BACKUP_TOOL_SHA ?? process.env.GITHUB_SHA ?? deployedSha;
  if (!/^[a-f0-9]{40}$/.test(expectedToolSha) || toolSha !== expectedToolSha)
    throw new Error(
      'checked out maintenance tool SHA does not match BACKUP_TOOL_SHA, GITHUB_SHA, or deployed SHA',
    );
  const dirty =
    (await commandOutput('git', ['status', '--porcelain'])).length > 0;
  if (process.env.NODE_ENV === 'production' && dirty)
    throw new Error('production backup refuses a dirty maintenance checkout');
  const configRevision = required('DEPLOYED_API_CONFIG_REVISION');
  const configRevisionDigest = createHash('sha256')
    .update(configRevision)
    .digest('hex');
  const key = Buffer.from(required('BACKUP_ENCRYPTION_KEY_BASE64'), 'base64');
  if (key.length !== 32)
    throw new Error('BACKUP_ENCRYPTION_KEY_BASE64 must decode to 32 bytes');
  const sourceBucket = required('S3_PUBLISHED_BUCKET');
  const prefix = `snapshots/${env}/${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const client = new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    credentials: {
      accessKeyId: required('S3_ACCESS_KEY_ID'),
      secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
    },
  });
  const dir = await mkdtemp(join(tmpdir(), 'isntgram-backup-'));
  const dump = join(dir, 'database.dump');
  await dataSource.initialize();
  try {
    await withMaintenanceLock(dataSource, env, 'backup', async (runner) => {
      await runner.startTransaction('REPEATABLE READ');
      try {
        const snapshot = (
          await runner.query('SELECT pg_export_snapshot() AS id')
        )[0].id as string;
        await run(process.env.PG_DUMP_BIN || 'pg_dump', [
          '--format=custom',
          '--snapshot',
          snapshot,
          '--file',
          dump,
          required('DATABASE_DIRECT_URL'),
        ]);
        const dumpBytes = await readFile(dump);
        const iv = randomBytes(12);
        const cipher = createCipheriv('aes-256-gcm', key, iv);
        const encrypted = Buffer.concat([
          cipher.update(dumpBytes),
          cipher.final(),
        ]);
        const tag = cipher.getAuthTag();
        const media = (await runner.query(
          `SELECT "publishedKey", "publishedChecksum", "publishedBytes", "publishedContentType" FROM "media_uploads" WHERE "publishedKey" IS NOT NULL AND ("postId" IS NOT NULL OR "profilePictureUserId" IS NOT NULL)`,
        )) as Array<{
          publishedKey: string;
          publishedChecksum: string;
          publishedBytes: number;
          publishedContentType: string;
        }>;
        const manifest = {
          version: 1,
          environment: env,
          createdAt: new Date().toISOString(),
          source: {
            deployed: {
              sha: deployedSha,
              tree: deployedTree,
              configRevisionDigest,
            },
            tool: { sha: toolSha, tree: toolTree, dirty },
          },
          migrations: await runner.query(
            'SELECT timestamp, name FROM migrations ORDER BY timestamp',
          ),
          database: {
            key: `${prefix}/database.dump.enc`,
            sha256: createHash('sha256').update(encrypted).digest('hex'),
            iv: iv.toString('base64'),
            tag: tag.toString('base64'),
          },
          media: media.map((m) => ({
            key: m.publishedKey,
            sha256: m.publishedChecksum,
            bytes: m.publishedBytes,
            contentType: m.publishedContentType,
          })),
        };
        await client.send(
          new PutObjectCommand({
            Bucket: backupBucket,
            Key: manifest.database.key,
            Body: encrypted,
            ContentType: 'application/octet-stream',
          }),
        );
        for (const object of media) {
          const got = await client.send(
            new GetObjectCommand({
              Bucket: sourceBucket,
              Key: object.publishedKey,
            }),
          );
          const bytes = await bodyBytes(got.Body);
          if (
            createHash('sha256').update(bytes).digest('hex') !==
            object.publishedChecksum
          )
            throw new Error(`media hash differs: ${object.publishedKey}`);
          await client.send(
            new PutObjectCommand({
              Bucket: backupBucket,
              Key: `${prefix}/media/${object.publishedKey}`,
              Body: bytes,
              ContentType: object.publishedContentType,
            }),
          );
        }
        const manifestBytes = Buffer.from(JSON.stringify(manifest));
        await client.send(
          new PutObjectCommand({
            Bucket: backupBucket,
            Key: `${prefix}/manifest.json`,
            Body: manifestBytes,
            ContentType: 'application/json',
          }),
        );
        await client.send(
          new PutObjectCommand({
            Bucket: backupBucket,
            Key: `${prefix}/COMPLETED`,
            Body: createHash('sha256').update(manifestBytes).digest('hex'),
            ContentType: 'text/plain',
          }),
        );
        console.log(
          JSON.stringify({ prefix, objects: media.length, completed: true }),
        );
        await runner.commitTransaction();
      } catch (error) {
        await runner.rollbackTransaction();
        throw error;
      }
    });
  } finally {
    await dataSource.destroy();
    client.destroy();
    await rm(dir, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
