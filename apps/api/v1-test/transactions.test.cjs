'use strict';

require('reflect-metadata');

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const test = require('node:test');
const { Client } = require('pg');
const { DataSource } = require('typeorm');
const config = require('../scripts/v1/config.cjs');
const preflight = require('../scripts/v1/preflight.cjs');

const { User } = require('../dist/users/entities/user.entity');
const { Post } = require('../dist/posts/entities/post.entity');
const { Like } = require('../dist/posts/entities/like.entity');
const { Comment } = require('../dist/posts/entities/comment.entity');
const { CommentLike } = require('../dist/posts/entities/comment-like.entity');
const { Follow } = require('../dist/follows/entities/follow.entity');
const {
  Notification,
} = require('../dist/notifications/entities/notification.entity');
const { PostsService } = require('../dist/posts/posts.service');
const { FollowsService } = require('../dist/follows/follows.service');
const {
  NotificationsWriter,
} = require('../dist/notifications/notifications.writer');

const TEST_TIMEOUT_MS = 10_000;
const LOCK_OBSERVATION_TIMEOUT_MS = 2_500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertProductionEnvironment() {
  assert.equal(
    process.env.NODE_ENV,
    'production',
    'v1 PostgreSQL tests require NODE_ENV=production',
  );
}

async function createHarness() {
  assertProductionEnvironment();
  const c = config.load();
  const verifiedClient = await preflight.connect(c, 'test');
  await verifiedClient.end();

  const database = config.database(c, 'test');
  const dataSource = new DataSource({
    type: 'postgres',
    host: database.host,
    port: database.port,
    username: database.user,
    password: database.password,
    database: database.database,
    ssl: false,
    synchronize: false,
    logging: false,
    connectTimeoutMS: 5000,
    extra: { statement_timeout: 5000, lock_timeout: 5000 },
    entities: [User, Post, Like, Comment, CommentLike, Follow, Notification],
  });

  await dataSource.initialize();
  const lockClient = new Client(database);
  await lockClient.connect();
  const notificationsWriter = new NotificationsWriter();

  const posts = new PostsService(
    dataSource.getRepository(Post),
    dataSource.getRepository(Like),
    dataSource.getRepository(Comment),
    dataSource.getRepository(CommentLike),
    dataSource.getRepository(Follow),
    dataSource.getRepository(User),
    dataSource,
    { get: () => undefined },
    notificationsWriter,
  );
  const follows = new FollowsService(
    dataSource.getRepository(Follow),
    dataSource.getRepository(User),
    dataSource,
    notificationsWriter,
  );

  return { c, dataSource, lockClient, posts, follows };
}

async function closeHarness(harness) {
  if (!harness) return;
  await harness.lockClient.query('ROLLBACK').catch(() => {});
  await harness.lockClient.end().catch(() => {});
  if (harness.dataSource.isInitialized) await harness.dataSource.destroy();
}

function fixtureUser(suffix, counts = {}) {
  return {
    username: `v1_tx_${suffix}`.slice(0, 50),
    fullName: `V1 transaction ${suffix}`,
    email: `v1-tx-${suffix}@example.invalid`,
    hashedPassword: 'test-only-hash',
    isDemoUser: false,
    isDemoSeed: false,
    postsCount: 0,
    followerCount: 0,
    followingCount: 0,
    ...counts,
  };
}

async function holdRelationLock(lockClient, table, relationId) {
  await lockClient.query('BEGIN');
  await lockClient.query(`SELECT id FROM ${table} WHERE id = $1 FOR UPDATE`, [
    relationId,
  ]);
}

async function waitForTwoLockWaiters(lockClient) {
  const deadline = Date.now() + LOCK_OBSERVATION_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await lockClient.query('SELECT pg_stat_clear_snapshot()');
    const { rows } = await lockClient.query(
      `SELECT count(*)::int AS count
       FROM pg_stat_activity
       WHERE datname = current_database()
         AND usename = current_user
         AND wait_event_type = 'Lock'`,
    );
    if (rows[0]?.count >= 2) return;
    await sleep(50);
  }
  assert.fail(
    'two concurrent service calls did not reach bounded PostgreSQL lock waits',
  );
}

async function releaseAndSettle(lockClient, calls) {
  const settled = Promise.allSettled(calls);
  try {
    await waitForTwoLockWaiters(lockClient);
    await lockClient.query('COMMIT');
  } catch (error) {
    await lockClient.query('ROLLBACK');
    await settled;
    throw error;
  }
  const results = await settled;
  for (const result of results)
    if (result.status === 'rejected') throw result.reason;
  return results.map((result) => result.value);
}

test(
  'test role cannot connect to the v1 application database',
  { timeout: TEST_TIMEOUT_MS },
  async () => {
    assertProductionEnvironment();
    const c = config.load();
    const verifiedClient = await preflight.connect(c, 'test');
    await verifiedClient.end();

    const testDatabase = config.database(c, 'test');
    const forbiddenClient = new Client({
      ...testDatabase,
      database: c.appDatabase,
    });
    try {
      await assert.rejects(forbiddenClient.connect(), { code: '42501' });
    } finally {
      await forbiddenClient.end().catch(() => {});
    }
  },
);

test(
  'concurrent post unlike decrements only once under a real PostgreSQL row lock',
  { timeout: TEST_TIMEOUT_MS },
  async () => {
    let harness;
    try {
      harness = await createHarness();
      const run = randomUUID();
      const users = harness.dataSource.getRepository(User);
      const posts = harness.dataSource.getRepository(Post);
      const likes = harness.dataSource.getRepository(Like);
      const author = await users.save(fixtureUser(`post-author-${run}`));
      const actor = await users.save(fixtureUser(`post-actor-${run}`));
      const other = await users.save(fixtureUser(`post-other-${run}`));
      const post = await posts.save({
        authorId: author.id,
        content: 'race post',
        likeCount: 2,
        commentCount: 0,
      });
      const targetLike = await likes.save({
        postId: post.id,
        userId: actor.id,
      });
      await likes.save({ postId: post.id, userId: other.id });

      await holdRelationLock(harness.lockClient, 'likes', targetLike.id);
      await releaseAndSettle(harness.lockClient, [
        harness.posts.unlikePost(actor.id, false, post.id),
        harness.posts.unlikePost(actor.id, false, post.id),
      ]);

      const remaining = await likes.count({ where: { postId: post.id } });
      const stored = await posts.findOneByOrFail({ id: post.id });
      assert.equal(remaining, 1);
      assert.equal(stored.likeCount, 1);
    } finally {
      await closeHarness(harness);
    }
  },
);

test(
  'concurrent comment unlike decrements only once under a real PostgreSQL row lock',
  { timeout: TEST_TIMEOUT_MS },
  async () => {
    let harness;
    try {
      harness = await createHarness();
      const run = randomUUID();
      const users = harness.dataSource.getRepository(User);
      const posts = harness.dataSource.getRepository(Post);
      const comments = harness.dataSource.getRepository(Comment);
      const likes = harness.dataSource.getRepository(CommentLike);
      const author = await users.save(fixtureUser(`comment-author-${run}`));
      const actor = await users.save(fixtureUser(`comment-actor-${run}`));
      const other = await users.save(fixtureUser(`comment-other-${run}`));
      const post = await posts.save({
        authorId: author.id,
        content: 'race post',
        likeCount: 0,
        commentCount: 1,
      });
      const comment = await comments.save({
        postId: post.id,
        authorId: author.id,
        content: 'race comment',
        likeCount: 2,
      });
      const targetLike = await likes.save({
        commentId: comment.id,
        userId: actor.id,
      });
      await likes.save({ commentId: comment.id, userId: other.id });

      await holdRelationLock(
        harness.lockClient,
        'comment_likes',
        targetLike.id,
      );
      await releaseAndSettle(harness.lockClient, [
        harness.posts.unlikeComment(actor.id, false, post.id, comment.id),
        harness.posts.unlikeComment(actor.id, false, post.id, comment.id),
      ]);

      const remaining = await likes.count({ where: { commentId: comment.id } });
      const stored = await comments.findOneByOrFail({ id: comment.id });
      assert.equal(remaining, 1);
      assert.equal(stored.likeCount, 1);
    } finally {
      await closeHarness(harness);
    }
  },
);

test(
  'concurrent unfollow decrements only once under a real PostgreSQL row lock',
  { timeout: TEST_TIMEOUT_MS },
  async () => {
    let harness;
    try {
      harness = await createHarness();
      const run = randomUUID();
      const users = harness.dataSource.getRepository(User);
      const follows = harness.dataSource.getRepository(Follow);
      const actor = await users.save(
        fixtureUser(`follow-actor-${run}`, { followingCount: 2 }),
      );
      const target = await users.save(
        fixtureUser(`follow-target-${run}`, { followerCount: 2 }),
      );
      const other = await users.save(fixtureUser(`follow-other-${run}`));
      const targetFollow = await follows.save({
        followerId: actor.id,
        followingId: target.id,
      });
      await follows.save({ followerId: actor.id, followingId: other.id });
      await follows.save({ followerId: other.id, followingId: target.id });

      await holdRelationLock(harness.lockClient, 'follows', targetFollow.id);
      await releaseAndSettle(harness.lockClient, [
        harness.follows.unfollowUser(actor.id, false, target.username),
        harness.follows.unfollowUser(actor.id, false, target.username),
      ]);

      const remaining = await follows.count({
        where: { followerId: actor.id, followingId: target.id },
      });
      const storedActor = await users.findOneByOrFail({ id: actor.id });
      const storedTarget = await users.findOneByOrFail({ id: target.id });
      assert.equal(remaining, 0);
      assert.equal(storedActor.followingCount, 1);
      assert.equal(storedTarget.followerCount, 1);
    } finally {
      await closeHarness(harness);
    }
  },
);

// Inject only an application failure after real SQL; all persistence and rollback remain native TypeORM/PG.
test(
  'post unlike rolls back its actual delete and decrement when the application fails',
  { timeout: TEST_TIMEOUT_MS },
  async () => {
    let h;
    let transaction;
    try {
      h = await createHarness();
      const run = randomUUID();
      const users = h.dataSource.getRepository(User);
      const posts = h.dataSource.getRepository(Post);
      const likes = h.dataSource.getRepository(Like);
      const author = await users.save(fixtureUser(`rollback-author-${run}`));
      const actor = await users.save(fixtureUser(`rollback-actor-${run}`));
      const post = await posts.save({
        authorId: author.id,
        content: 'retained rollback proof',
        likeCount: 1,
      });
      const like = await likes.save({ postId: post.id, userId: actor.id });
      transaction = h.dataSource.transaction.bind(h.dataSource);
      let wrote = false;
      h.dataSource.transaction = (callback) =>
        transaction(async (manager) => {
          const repo = manager.getRepository(Post);
          const decrement = repo.decrement.bind(repo);
          repo.decrement = async (...args) => {
            await decrement(...args);
            assert.equal(
              (await repo.findOneByOrFail({ id: post.id })).likeCount,
              0,
            );
            wrote = true;
            throw new Error(
              'injected application failure after real decrement',
            );
          };
          return callback(manager);
        });
      await assert.rejects(
        h.posts.unlikePost(actor.id, false, post.id),
        /injected application failure/,
      );
      assert.equal(wrote, true);
      assert.equal((await posts.findOneByOrFail({ id: post.id })).likeCount, 1);
      assert.equal(
        (await likes.findOneByOrFail({ id: like.id })).userId,
        actor.id,
      );
    } finally {
      if (h && transaction) h.dataSource.transaction = transaction;
      await closeHarness(h);
    }
  },
);

test(
  'unfollow rolls back its real relation deletion and first counter write on application failure',
  { timeout: TEST_TIMEOUT_MS },
  async () => {
    let h;
    let transaction;
    try {
      h = await createHarness();
      const run = randomUUID();
      const users = h.dataSource.getRepository(User);
      const follows = h.dataSource.getRepository(Follow);
      const actor = await users.save(
        fixtureUser(`rollback-follow-actor-${run}`, { followingCount: 1 }),
      );
      const target = await users.save(
        fixtureUser(`rollback-follow-target-${run}`, { followerCount: 1 }),
      );
      const relation = await follows.save({
        followerId: actor.id,
        followingId: target.id,
      });
      transaction = h.dataSource.transaction.bind(h.dataSource);
      let wrote = false;
      h.dataSource.transaction = (callback) =>
        transaction(async (manager) => {
          const decrement = manager.decrement.bind(manager);
          manager.decrement = async (...args) => {
            await decrement(...args);
            assert.equal(
              await manager.count(Follow, { where: { id: relation.id } }),
              0,
            );
            wrote = true;
            throw new Error('injected application failure after first counter');
          };
          return callback(manager);
        });
      await assert.rejects(
        h.follows.unfollowUser(actor.id, false, target.username),
        /injected application failure/,
      );
      assert.equal(wrote, true);
      assert.equal(
        (await users.findOneByOrFail({ id: actor.id })).followingCount,
        1,
      );
      assert.equal(
        (await users.findOneByOrFail({ id: target.id })).followerCount,
        1,
      );
      assert.equal(
        (await follows.findOneByOrFail({ id: relation.id })).followerId,
        actor.id,
      );
    } finally {
      if (h && transaction) h.dataSource.transaction = transaction;
      await closeHarness(h);
    }
  },
);
