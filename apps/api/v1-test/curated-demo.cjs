'use strict';

// Native, main-only proof for CuratedDemoService. It intentionally retains all
// existing records and never exposes credentials or access tokens.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const config = require('../scripts/v1/config.cjs');
const preflight = require('../scripts/v1/preflight.cjs');
const storage = require('../scripts/v1/storage.cjs');

const TABLES = Object.freeze([
  'users', 'posts', 'likes', 'comments', 'comment_likes', 'follows',
  'notifications', 'media_uploads',
]);
const CURATED_DEMO_LOCK = 1230196308;
const UUID_SCHEMA = /^v1_migration_[0-9a-f]{32}$/;

function fail(message) { throw new Error(`Curated demo proof refused: ${message}`); }

function privateReceipt(file, value) {
  config.statePath(file);
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8', flag: 'wx', mode: 0o600,
  });
}

function treeHashes(directory) {
  return Object.fromEntries(fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) fail('indirect source input');
    if (entry.isDirectory()) return Object.entries(treeHashes(file));
    return entry.isFile() ? [[path.relative(config.ROOT, file), config.hashFile(file)]] : [];
  }));
}

function sourceInputs() {
  const corpus = path.join(config.ROOT, 'fixtures/v1/content.json');
  return {
    apiSource: treeHashes(path.join(config.ROOT, 'apps/api/src')),
    sharedTypesSource: treeHashes(path.join(config.ROOT, 'packages/shared-types/src')),
    corpusSha256: config.hashFile(corpus),
    harnessSha256: config.hashFile(__filename),
  };
}

function compiledInputs() {
  return {
    apiDist: treeHashes(path.join(config.ROOT, 'apps/api/dist')),
    sharedTypesDist: treeHashes(path.join(config.ROOT, 'packages/shared-types/dist')),
  };
}

function assertSourceInputs(expected, stage) {
  assert.deepEqual(sourceInputs(), expected, `source, corpus, or harness changed during ${stage}`);
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
      if (result.status !== 0) fail('compiled application build failed; private log retained');
    }
  } finally { fs.closeSync(fd); }
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function tableSnapshot(client, schema, table) {
  const rows = await client.query(
    `SELECT row_to_json(t)::text AS value FROM "${schema}"."${table}" t ORDER BY t.id`,
  );
  const byId = {};
  for (const row of rows.rows) {
    const value = String(row.value);
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed.id !== 'string') fail(`unsafe ${schema}.${table} row identity`);
    if (Object.hasOwn(byId, parsed.id)) fail(`duplicate ${schema}.${table} row identity`);
    byId[parsed.id] = hash(value);
  }
  return byId;
}

async function snapshotSchema(client, schema, tables = TABLES) {
  const available = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = $1 AND tablename = ANY($2::text[])`,
    [schema, tables],
  );
  const found = new Set(available.rows.map((row) => row.tablename));
  if (schema === 'public' && found.size !== tables.length) fail('application table inventory differs');
  const out = {};
  for (const table of tables) out[table] = found.has(table) ? await tableSnapshot(client, schema, table) : {};
  return out;
}

function rowCount(snapshot) {
  return Object.values(snapshot).reduce((count, table) => count + Object.keys(table).length, 0);
}

function assertRetained(before, after, label) {
  for (const [table, rows] of Object.entries(before)) {
    for (const [id, rowHash] of Object.entries(rows))
      assert.equal(after[table]?.[id], rowHash, `${label} retained ${table}/${id} changed or disappeared`);
  }
}

function assertOnlyVisitorAdded(before, after, visitorId) {
  assertRetained(before, after, 'app');
  for (const table of TABLES) {
    const additions = Object.keys(after[table]).filter((id) => !Object.hasOwn(before[table], id));
    if (table === 'users') assert.deepEqual(additions, [visitorId], 'only the successful demo visitor may be added');
    else assert.deepEqual(additions, [], `unexpected ${table} rows were added`);
  }
}

async function snapshotRetainedTestRows(c) {
  const client = await preflight.connect(c, 'test');
  try {
    const namespaces = await client.query(
      `SELECT nspname, pg_get_userbyid(nspowner) AS owner, current_user AS role
       FROM pg_namespace WHERE nspname LIKE 'v1_migration_%'`,
    );
    for (const row of namespaces.rows)
      if (!UUID_SCHEMA.test(row.nspname) || row.owner !== row.role)
        fail('unrecognized retained test schema');
    const schemas = ['public', ...namespaces.rows.map((row) => row.nspname)];
    const relations = await client.query(
      `SELECT schemaname, tablename, tableowner, current_user AS role
       FROM pg_tables WHERE schemaname = ANY($1::text[]) AND tablename = ANY($2::text[])`,
      [schemas, TABLES],
    );
    for (const row of relations.rows)
      if (!schemas.includes(row.schemaname) || !TABLES.includes(row.tablename) || row.tableowner !== row.role)
        fail('unowned retained test table');
    const snapshots = {};
    for (const schema of schemas) snapshots[schema] = await snapshotSchema(client, schema);
    const count = Object.values(snapshots).reduce((n, value) => n + rowCount(value), 0);
    if (!Number.isSafeInteger(count) || count > 1000) fail('retained test-record baseline exceeds 1000');
    return { count, snapshots };
  } finally { await client.end(); }
}

async function requireConflict(promise, label) {
  try {
    await promise;
  } catch (error) {
    if (error && typeof error.getStatus === 'function' && error.getStatus() === 409) return;
    fail(`${label} did not reject with a conflict`);
  }
  fail(`${label} unexpectedly succeeded`);
}

function assertSession(session) {
  assert.equal(session?.isDemoUser, true, 'successful session must be a demo visitor');
  assert.equal(typeof session?.accessToken, 'string', 'successful session must sign an access token');
  assert.ok(session.accessToken.length > 20, 'successful session token is unexpectedly short');
  assert.equal(typeof session?.user?.id, 'string', 'successful session has no visitor identity');
  assert.equal(session.user.profilePictureUrl ?? null, null, 'visitor avatar must remain neutral');
  assert.ok(Date.parse(session.demoExpiresAt) > Date.now(), 'visitor expiry must be in the future');
}

async function run() {
  const c = config.load();
  const evidence = path.join(config.STATE, 'evidence');
  config.statePath(evidence);
  const id = crypto.randomUUID();
  const intent = path.join(evidence, `curated-demo-${id}-intent.json`);
  let stage = 'guard';
  let visitorId = null;
  try {
    preflight.freePorts([4321, 4322]);
    preflight.capacity();
    const storageIdentity = storage.completeQualification(c);
    const appGuard = await preflight.connect(c, 'app');
    await appGuard.end();
    stage = 'snapshot-test';
    const testBefore = await snapshotRetainedTestRows(c);
    const sourceBinding = sourceInputs();
    const compiledBefore = compiledInputs();
    privateReceipt(intent, {
      branch: c.branch,
      revision: config.native('/usr/bin/git', ['rev-parse', 'HEAD']).trim(),
      native: preflight.running(c), storage: storageIdentity,
      retainedTestRecords: testBefore.count, source: sourceBinding, compiledBefore,
      purpose: 'main-only CuratedDemoService native proof',
    });
    stage = 'build';
    compile(c, path.join(evidence, `curated-demo-${id}-build.log`));
    assertSourceInputs(sourceBinding, 'build');
    const compiledAfter = compiledInputs();
    stage = 'snapshot-app';
    const appClient = await preflight.connect(c, 'app');
    let app;
    try {
    const appBefore = await snapshotSchema(appClient, 'public');
    const appRecords = rowCount(appBefore);
    if (!Number.isSafeInteger(appRecords) || appRecords + testBefore.count + 1 > 1000)
      fail('combined app/test record baseline cannot reserve one visitor');
    const recordLimit = appRecords + 1;
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, {
      ...config.appEnvironment(c),
      DEMO_ENABLED: 'true', NEXT_PUBLIC_DEMO_ENABLED: 'true',
      DEMO_CONTENT_SOURCE: 'curated', NEXT_PUBLIC_DEMO_CONTENT_SOURCE: 'curated',
      DEMO_RECORD_LIMIT: String(recordLimit), METRICS_ENABLED: 'false',
    });
    require('reflect-metadata');
    const { NestFactory } = require('@nestjs/core');
    const { AppModule } = require('../dist/app.module');
    const { DataSource } = require('typeorm');
    const { CuratedDemoService } = require('../dist/auth/demo/curated-demo.service');
    const { PostsService } = require('../dist/posts/posts.service');
    const { fixturePosts, loadCuratedCorpus } = require('../dist/fixtures/curated-corpus');
    app = await NestFactory.createApplicationContext(AppModule, { logger: false, abortOnError: false });
    const database = app.get(DataSource);
    const service = app.get(CuratedDemoService);
    const posts = app.get(PostsService);
    const corpus = loadCuratedCorpus();
    const expectedPosts = fixturePosts(corpus).filter((post) => corpus.demoSeeds.some((seed) => seed.id === post.authorId));
    if (expectedPosts.length !== 6) fail('curated corpus demo-post inventory differs');

    stage = 'held-advisory-lock';
    const lock = await preflight.connect(c, 'app');
    try {
      const held = await lock.query('SELECT pg_try_advisory_lock($1::bigint) AS locked', [CURATED_DEMO_LOCK]);
      if (held.rows[0]?.locked !== true) fail('proof could not acquire curated demo advisory lock');
      await requireConflict(service.createSession(), 'held advisory-lock entry');
      assert.deepEqual(await snapshotSchema(appClient, 'public'), appBefore, 'held advisory lock must not create a visitor');
    } finally {
      await lock.query('SELECT pg_advisory_unlock($1::bigint)', [CURATED_DEMO_LOCK]).catch(() => {});
      await lock.end();
    }

    stage = 'concurrent-entry';
    const concurrent = await Promise.allSettled([service.createSession(), service.createSession()]);
    const successful = concurrent.filter((result) => result.status === 'fulfilled').map((result) => result.value);
    const refused = concurrent.filter((result) => result.status === 'rejected');
    assert.equal(successful.length, 1, 'capacity-raced entries must retain at most one visitor');
    assert.equal(refused.length, 1, 'capacity-raced second entry must be refused');
    await requireConflict(Promise.reject(refused[0].reason), 'capacity-raced entry');
    const session = successful[0];
    assertSession(session);
    visitorId = session.user.id;
    const appAfterVisitor = await snapshotSchema(appClient, 'public');
    assertOnlyVisitorAdded(appBefore, appAfterVisitor, visitorId);
    const visitor = await database.query(
      'SELECT "postsCount", "followerCount", "followingCount", "isDemoUser", "isDemoSeed", "profilePictureUrl" FROM users WHERE id = $1', [visitorId],
    );
    assert.deepEqual(visitor[0], {
      postsCount: 0, followerCount: 0, followingCount: 0,
      isDemoUser: true, isDemoSeed: false, profilePictureUrl: null,
    }, 'visitor starts without engagement or avatar');
    const followRows = await database.query('SELECT count(*)::int AS count FROM follows WHERE "followerId" = $1 OR "followingId" = $1', [visitorId]);
    assert.equal(followRows[0]?.count, 0, 'visitor must not start with follows');
    stage = 'feed';
    const feed = await posts.getFeed(visitorId, true, { limit: 6 });
    assert.equal(feed.items.length, 6, 'demo visitor feed must contain the six curated seed posts');
    assert.equal(feed.nextCursor, undefined, 'demo visitor feed must contain no ordinary posts');
    assert.deepEqual(new Set(feed.items.map((item) => item.id)), new Set(expectedPosts.map((post) => post.id)), 'feed post identities differ from the curated seeds');
    assert.ok(feed.items.every((item) => corpus.demoSeeds.some((seed) => seed.id === item.author.id)), 'feed contains a non-seed author');

    const afterFeed = await snapshotSchema(appClient, 'public');
    assert.deepEqual(afterFeed, appAfterVisitor, 'feed read must not change application rows');
    stage = 'post-capacity-entry';
    await requireConflict(service.createSession(), 'post-capacity entry');
    assert.deepEqual(await snapshotSchema(appClient, 'public'), appAfterVisitor, 'capacity refusal must add no rows');
    const testAfter = await snapshotRetainedTestRows(c);
    assert.deepEqual(testAfter, testBefore, 'retained test rows changed');
    stage = 'final-binding';
    assertSourceInputs(sourceBinding, 'execution');
    const receipt = path.join(evidence, `curated-demo-${id}-complete.json`);
    privateReceipt(receipt, {
      intent, source: sourceBinding, compiledBefore, compiledAfter,
      retainedTestRecords: testBefore.count, appBaselineRecords: appRecords,
      recordLimit, createdVisitors: 1, feedSeedPosts: 6,
      visitorId, appBefore, appAfterVisitor, testBefore, testAfter,
      storage: storageIdentity,
    });
    return { receipt, createdVisitors: 1, feedSeedPosts: 6 };
    } finally {
      await app?.close().catch(() => {});
      await appClient.end();
    }
  } catch (error) {
    // The reason is intentionally fixed. Private evidence must not serialize a
    // token, SQL error, request detail, or an arbitrary thrown value.
    try {
      privateReceipt(path.join(evidence, `curated-demo-${id}-failed.json`), {
        intent, reason: 'proof_refused_or_incomplete',
        stage: typeof stage === 'string' ? stage : 'unknown',
        visitorIdKnown: Boolean(visitorId),
      });
    } catch {}
    throw error;
  }
}

if (require.main === module)
  Promise.resolve().then(run).then((result) => console.log(JSON.stringify(result))).catch(() => {
    console.error('Curated demo proof refused or incomplete. Inspect private intent/build evidence; no cleanup was attempted.');
    process.exitCode = 1;
  });

module.exports = { run, snapshotSchema, snapshotRetainedTestRows, treeHashes };
