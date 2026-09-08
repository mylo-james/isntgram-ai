'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const config = require('./config.cjs');
const preflight = require('./preflight.cjs');
const storage = require('./storage.cjs');

const TABLES = ['users', 'posts', 'likes', 'comments', 'comment_likes',
  'follows', 'notifications', 'media_uploads'];

async function retainedTestRecords(c) {
  const client = await preflight.connect(c, 'test');
  try {
    const namespaces = await client.query(`SELECT nspname, pg_get_userbyid(nspowner) AS owner,
      current_user AS role FROM pg_namespace WHERE nspname LIKE 'v1_migration_%'`);
    for (const row of namespaces.rows)
      if (!/^v1_migration_[0-9a-f]{32}$/.test(row.nspname) || row.owner !== row.role)
        throw new Error('Unrecognized retained test schema');
    const schemas = ['public', ...namespaces.rows.map((row) => row.nspname)];
    const tables = await client.query(`SELECT schemaname, tablename, tableowner, current_user AS role
      FROM pg_tables WHERE schemaname=ANY($1) AND tablename=ANY($2)`, [schemas, TABLES]);
    let count = 0;
    for (const row of tables.rows) {
      if (!schemas.includes(row.schemaname) || !TABLES.includes(row.tablename) || row.tableowner !== row.role)
        throw new Error('Unowned retained test table');
      const result = await client.query(`SELECT count(*)::int AS count FROM "${row.schemaname}"."${row.tablename}"`);
      count += result.rows[0].count;
    }
    if (!Number.isSafeInteger(count) || count >= 1000) throw new Error('Retained record budget exhausted');
    return count;
  } finally { await client.end(); }
}

function treeHashes(directory) {
  return Object.fromEntries(fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Indirect source input');
    if (entry.isDirectory()) return Object.entries(treeHashes(file));
    return entry.isFile() ? [[path.relative(config.ROOT, file), config.hashFile(file)]] : [];
  }));
}
function privateReceipt(file, value) {
  config.statePath(file);
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}
function compile(c, log) {
  const fd = fs.openSync(log, 'wx', 0o600);
  try {
    for (const cwd of ['packages/shared-types', 'apps/api']) {
      const args = [path.join(config.ROOT, cwd, 'node_modules/typescript/bin/tsc')];
      if (cwd === 'apps/api') args.push('--project', 'tsconfig.build.json');
      const result = spawnSync(path.join(c.nodeBin, 'node'), args, {
        cwd: path.join(config.ROOT, cwd), env: config.nativeEnv(),
        stdio: ['ignore', fd, fd], timeout: 60000,
      });
      if (result.status !== 0) throw new Error('Fixture build failed; private log retained');
    }
  } finally { fs.closeSync(fd); }
}

async function run(action, postId) {
  if (!['apply', 'verify', 'post'].includes(action) ||
    (action === 'post' && !/^[a-f0-9]{8}-[a-f0-9]{4}-[45][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(postId || '')))
    throw new Error('Invalid fixture action or post ID');
  const c = config.load();
  // Every fixture action compiles. Refuse while the API can be watching this output.
  preflight.freePorts([4321, 4322]);
  preflight.noApiBuildProcesses();
  preflight.capacity();
  const storageBefore = storage.completeQualification(c);
  const appTarget = await preflight.connect(c, 'app');
  await appTarget.end();
  const testRecords = await retainedTestRecords(c);
  const before = treeHashes(path.join(config.ROOT, 'apps/api/src'));
  const evidence = path.join(config.STATE, 'evidence');
  config.statePath(evidence);
  const id = crypto.randomUUID();
  const intent = path.join(evidence, `fixture-${id}-intent.json`);
  privateReceipt(intent, { action, postId, branch: c.branch,
    revision: config.native('/usr/bin/git', ['rev-parse', 'HEAD']).trim(), systemId: c.systemId,
    storage: storageBefore, retainedTestRecords: testRecords, appRecordLimit: 1000 - testRecords,
    source: before, corpusSha256: config.hashFile(path.join(config.ROOT, 'fixtures/v1/content.json')) });
  compile(c, path.join(evidence, `fixture-${id}-build.log`));
  if (JSON.stringify(before) !== JSON.stringify(treeHashes(path.join(config.ROOT, 'apps/api/src'))))
    throw new Error('Source changed during fixture build');
  const env = { ...config.appEnvironment(c), DEMO_ENABLED: 'false', METRICS_ENABLED: 'false' };
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, env);
  require('reflect-metadata');
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../../dist/app.module');
  const { DataSource } = require('typeorm');
  const { AuthService } = require('../../dist/auth/auth.service');
  const { PostsService } = require('../../dist/posts/posts.service');
  const { MediaService } = require('../../dist/media/media.service');
  const { Post } = require('../../dist/posts/entities/post.entity');
  const { MediaUpload } = require('../../dist/media/entities/media-upload.entity');
  const operation = require('../../dist/fixtures/fixture-operation');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false, abortOnError: false });
  try {
    const deps = { database: app.get(DataSource), auth: app.get(AuthService),
      posts: app.get(PostsService), media: app.get(MediaService),
      storageOrigin: c.storageEndpoint, recordLimit: 1000 - testRecords };
    let result;
    if (action === 'post') {
      const post = await deps.database.getRepository(Post).findOne({ where: { id: postId } });
      if (!post) throw new Error('Post not found');
      const upload = await deps.database.getRepository(MediaUpload).findOne({ where: { postId } });
      const media = upload ? await deps.media.verifyBoundPublication(post.authorId, upload.id) : null;
      if (post.mediaUrl && (!media || media.url !== post.mediaUrl)) throw new Error('Post media binding differs');
      result = { postId, authorId: post.authorId, content: post.content, media };
    } else {
      result = await operation.runFixtureOperation(deps, action, c.secrets.ISNTGRAM_V1_FIXTURE_PASSWORD);
    }
    if (JSON.stringify(before) !== JSON.stringify(treeHashes(path.join(config.ROOT, 'apps/api/src'))))
      throw new Error('Fixture source changed during execution');
    const receipt = path.join(evidence, `fixture-${id}-complete.json`);
    privateReceipt(receipt, { action, intent, result, compiled: treeHashes(path.join(config.ROOT, 'apps/api/dist')) });
    return { receipt, action, createdPosts: result.createdPosts ?? 0, verifiedPostId: postId };
  } finally { await app.close(); }
}

if (require.main === module)
  Promise.resolve().then(() => run(config.args(1)[0])).then((result) => console.log(JSON.stringify(result))).catch(() => {
    console.error('Fixture refused or incomplete. Inspect retained intent/build evidence; no cleanup was attempted.');
    process.exitCode = 1;
  });
module.exports = { run, retainedTestRecords, treeHashes };
