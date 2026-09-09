'use strict';

require('reflect-metadata');

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { ConfigService } = require('@nestjs/config');
const test = require('node:test');
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
const {
  NotificationsService,
} = require('../dist/notifications/notifications.service');

const TEST_TIMEOUT_MS = 10_000;
// This file retains at most 37 rows: follow lifecycle 6, social actions 14,
// three rollback fixtures 8, and reader fixtures 9. transactions.test.cjs
// retains at most 26 rows. migrations.test.cjs retains at most 6 application
// rows across its UUID schemas, for a 69-row all-suite source upper bound.
const RETAINED_ROWS_MAX = 37;

function assertProductionEnvironment() {
  assert.equal(
    process.env.NODE_ENV,
    'production',
    'v1 PostgreSQL tests require NODE_ENV=production',
  );
}

function fixtureUser(suffix, options = {}) {
  return {
    username: ('v1_nt_' + suffix).slice(0, 50),
    fullName: 'V1 notifications ' + suffix,
    email: 'v1-nt-' + suffix + '@example.invalid',
    hashedPassword: 'test-only-hash',
    isDemoUser: false,
    isDemoSeed: false,
    postsCount: 0,
    followerCount: 0,
    followingCount: 0,
    ...options,
  };
}

async function createHarness(writer = new NotificationsWriter()) {
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
    migrationsRun: false,
    logging: false,
    connectTimeoutMS: 5000,
    extra: { statement_timeout: 5000, lock_timeout: 5000 },
    entities: [User, Post, Like, Comment, CommentLike, Follow, Notification],
  });
  await dataSource.initialize();

  return {
    dataSource,
    posts: new PostsService(
      dataSource.getRepository(Post),
      dataSource.getRepository(Like),
      dataSource.getRepository(Comment),
      dataSource.getRepository(CommentLike),
      dataSource.getRepository(Follow),
      dataSource.getRepository(User),
      dataSource,
      { get: () => undefined },
      writer,
    ),
    follows: new FollowsService(
      dataSource.getRepository(Follow),
      dataSource.getRepository(User),
      dataSource,
      writer,
    ),
    notificationReader: new NotificationsService(
      dataSource.getRepository(Notification),
      dataSource,
      new ConfigService({}),
    ),
  };
}

async function closeHarness(harness) {
  if (harness?.dataSource?.isInitialized) await harness.dataSource.destroy();
}

async function notificationFor(repository, type, sourceId) {
  return repository.findOneByOrFail({ type, sourceId });
}

test(
  'follow source identity is idempotent while active, survives unfollow, and renews on re-follow',
  { timeout: TEST_TIMEOUT_MS },
  async () => {
    let h;
    try {
      h = await createHarness();
      const run = randomUUID();
      const users = h.dataSource.getRepository(User);
      const follows = h.dataSource.getRepository(Follow);
      const notifications = h.dataSource.getRepository(Notification);
      const actor = await users.save(fixtureUser('follow-actor-' + run));
      const recipient = await users.save(
        fixtureUser('follow-recipient-' + run),
      );

      await h.follows.followUser(actor.id, false, recipient.username);
      const first = await follows.findOneByOrFail({
        followerId: actor.id,
        followingId: recipient.id,
      });
      const firstNotification = await notificationFor(
        notifications,
        'follow',
        first.id,
      );
      assert.equal(firstNotification.recipientId, recipient.id);
      assert.equal(firstNotification.actorId, actor.id);
      assert.equal(firstNotification.postId, null);
      assert.equal(firstNotification.commentId, null);

      await h.follows.followUser(actor.id, false, recipient.username);
      assert.equal(
        await notifications.count({
          where: {
            recipientId: recipient.id,
            actorId: actor.id,
            type: 'follow',
          },
        }),
        1,
      );

      await h.follows.unfollowUser(actor.id, false, recipient.username);
      assert.equal(
        await notifications.count({
          where: {
            recipientId: recipient.id,
            actorId: actor.id,
            type: 'follow',
          },
        }),
        1,
      );

      await h.follows.followUser(actor.id, false, recipient.username);
      const second = await follows.findOneByOrFail({
        followerId: actor.id,
        followingId: recipient.id,
      });
      assert.notEqual(second.id, first.id);
      const renewed = await notificationFor(notifications, 'follow', second.id);
      assert.equal(renewed.recipientId, recipient.id);
      assert.equal(
        await notifications.count({
          where: {
            recipientId: recipient.id,
            actorId: actor.id,
            type: 'follow',
          },
        }),
        2,
      );
    } finally {
      await closeHarness(h);
    }
  },
);

test(
  'post likes and identical comment actions retain action UUID records, suppress self, and isolate demo posts',
  { timeout: TEST_TIMEOUT_MS },
  async () => {
    let h;
    try {
      h = await createHarness();
      const run = randomUUID();
      const users = h.dataSource.getRepository(User);
      const posts = h.dataSource.getRepository(Post);
      const likes = h.dataSource.getRepository(Like);
      const comments = h.dataSource.getRepository(Comment);
      const notifications = h.dataSource.getRepository(Notification);
      const author = await users.save(fixtureUser('author-' + run));
      const actor = await users.save(fixtureUser('actor-' + run));
      const demoAuthor = await users.save(
        fixtureUser('demo-author-' + run, { isDemoUser: true }),
      );
      const post = await posts.save({
        authorId: author.id,
        content: 'ordinary notification target',
        likeCount: 0,
        commentCount: 0,
      });
      const demoPost = await posts.save({
        authorId: demoAuthor.id,
        content: 'demo notification target',
        likeCount: 0,
        commentCount: 0,
      });

      await h.posts.likePost(actor.id, false, post.id);
      const like = await likes.findOneByOrFail({
        postId: post.id,
        userId: actor.id,
      });
      const likeNotification = await notificationFor(
        notifications,
        'like',
        like.id,
      );
      assert.equal(likeNotification.recipientId, author.id);
      assert.equal(likeNotification.actorId, actor.id);
      assert.equal(likeNotification.postId, post.id);
      assert.equal(likeNotification.commentId, null);

      await h.posts.likePost(actor.id, false, post.id);
      assert.equal(
        await notifications.count({
          where: {
            recipientId: author.id,
            actorId: actor.id,
            postId: post.id,
            type: 'like',
          },
        }),
        1,
      );
      await h.posts.unlikePost(actor.id, false, post.id);
      assert.equal(
        await notifications.count({
          where: {
            recipientId: author.id,
            actorId: actor.id,
            postId: post.id,
            type: 'like',
          },
        }),
        1,
      );
      await h.posts.likePost(actor.id, false, post.id);
      const renewedLike = await likes.findOneByOrFail({
        postId: post.id,
        userId: actor.id,
      });
      assert.notEqual(renewedLike.id, like.id);
      await notificationFor(notifications, 'like', renewedLike.id);
      assert.equal(
        await notifications.count({
          where: {
            recipientId: author.id,
            actorId: actor.id,
            postId: post.id,
            type: 'like',
          },
        }),
        2,
      );

      await h.posts.likePost(author.id, false, post.id);
      assert.equal(
        await notifications.count({
          where: {
            recipientId: author.id,
            actorId: actor.id,
            postId: post.id,
            type: 'like',
          },
        }),
        2,
      );

      await h.posts.createComment(actor.id, false, post.id, {
        content: 'same comment body',
      });
      await h.posts.createComment(actor.id, false, post.id, {
        content: 'same comment body',
      });
      const persistedComments = await comments.find({
        where: { postId: post.id, authorId: actor.id },
        order: { createdAt: 'ASC', id: 'ASC' },
      });
      assert.equal(persistedComments.length, 2);
      assert.notEqual(persistedComments[0].id, persistedComments[1].id);
      for (const comment of persistedComments) {
        const notification = await notificationFor(
          notifications,
          'comment',
          comment.id,
        );
        assert.equal(notification.recipientId, author.id);
        assert.equal(notification.commentId, comment.id);
        assert.equal(notification.postId, post.id);
      }

      await h.posts.createComment(author.id, false, post.id, {
        content: 'self comment is not a notification',
      });
      const selfComment = await comments.findOneByOrFail({
        postId: post.id,
        authorId: author.id,
      });
      assert.equal(
        await notifications.count({
          where: { type: 'comment', sourceId: selfComment.id },
        }),
        0,
      );

      await assert.rejects(
        h.posts.likePost(actor.id, false, demoPost.id),
        /Post not found/,
      );
      assert.equal(
        await likes.count({ where: { postId: demoPost.id, userId: actor.id } }),
        0,
      );
      assert.equal(
        await notifications.count({ where: { postId: demoPost.id } }),
        0,
      );
    } finally {
      await closeHarness(h);
    }
  },
);

function writerThatFailsAfterActualInsert() {
  let notificationWasInserted = false;
  return {
    writer: {
      async write(manager, notification) {
        await new NotificationsWriter().write(manager, notification);
        assert.equal(
          await manager.count(Notification, {
            where: { type: notification.type, sourceId: notification.sourceId },
          }),
          1,
        );
        notificationWasInserted = true;
        throw new Error('injected failure after notification insert');
      },
    },
    notificationWasInserted: () => notificationWasInserted,
  };
}

test(
  'a follow writer failure after an actual insert rolls back the notification, relation, and counters',
  { timeout: TEST_TIMEOUT_MS },
  async () => {
    let h;
    try {
      const failure = writerThatFailsAfterActualInsert();
      h = await createHarness(failure.writer);
      const run = randomUUID();
      const users = h.dataSource.getRepository(User);
      const follows = h.dataSource.getRepository(Follow);
      const notifications = h.dataSource.getRepository(Notification);
      const actor = await users.save(
        fixtureUser('rollback-follow-actor-' + run),
      );
      const recipient = await users.save(
        fixtureUser('rollback-follow-recipient-' + run),
      );

      await assert.rejects(
        h.follows.followUser(actor.id, false, recipient.username),
        /injected failure after notification insert/,
      );
      assert.equal(failure.notificationWasInserted(), true);
      assert.equal(
        await follows.count({
          where: { followerId: actor.id, followingId: recipient.id },
        }),
        0,
      );
      assert.equal(
        await notifications.count({
          where: {
            recipientId: recipient.id,
            actorId: actor.id,
            type: 'follow',
          },
        }),
        0,
      );
      assert.equal(
        (await users.findOneByOrFail({ id: actor.id })).followingCount,
        0,
      );
      assert.equal(
        (await users.findOneByOrFail({ id: recipient.id })).followerCount,
        0,
      );
    } finally {
      await closeHarness(h);
    }
  },
);

test(
  'a like writer failure after an actual insert rolls back the notification, like, and counter',
  { timeout: TEST_TIMEOUT_MS },
  async () => {
    let h;
    try {
      const failure = writerThatFailsAfterActualInsert();
      h = await createHarness(failure.writer);
      const run = randomUUID();
      const users = h.dataSource.getRepository(User);
      const posts = h.dataSource.getRepository(Post);
      const likes = h.dataSource.getRepository(Like);
      const notifications = h.dataSource.getRepository(Notification);
      const author = await users.save(
        fixtureUser('rollback-like-author-' + run),
      );
      const actor = await users.save(fixtureUser('rollback-like-actor-' + run));
      const post = await posts.save({
        authorId: author.id,
        content: 'rollback like notification target',
        likeCount: 0,
        commentCount: 0,
      });

      await assert.rejects(
        h.posts.likePost(actor.id, false, post.id),
        /injected failure after notification insert/,
      );
      assert.equal(failure.notificationWasInserted(), true);
      assert.equal(
        await notifications.count({
          where: { recipientId: author.id, actorId: actor.id, postId: post.id },
        }),
        0,
      );
      assert.equal(
        await likes.count({ where: { postId: post.id, userId: actor.id } }),
        0,
      );
      assert.equal((await posts.findOneByOrFail({ id: post.id })).likeCount, 0);
    } finally {
      await closeHarness(h);
    }
  },
);

test(
  'a comment writer failure after an actual insert rolls back the notification, comment, and counter',
  { timeout: TEST_TIMEOUT_MS },
  async () => {
    let h;
    try {
      const failure = writerThatFailsAfterActualInsert();
      h = await createHarness(failure.writer);
      const run = randomUUID();
      const users = h.dataSource.getRepository(User);
      const posts = h.dataSource.getRepository(Post);
      const comments = h.dataSource.getRepository(Comment);
      const notifications = h.dataSource.getRepository(Notification);
      const author = await users.save(
        fixtureUser('rollback-comment-author-' + run),
      );
      const actor = await users.save(
        fixtureUser('rollback-comment-actor-' + run),
      );
      const post = await posts.save({
        authorId: author.id,
        content: 'rollback comment notification target',
        likeCount: 0,
        commentCount: 0,
      });

      await assert.rejects(
        h.posts.createComment(actor.id, false, post.id, {
          content: 'rollback comment',
        }),
        /injected failure after notification insert/,
      );
      assert.equal(failure.notificationWasInserted(), true);
      assert.equal(
        await notifications.count({
          where: { recipientId: author.id, actorId: actor.id, postId: post.id },
        }),
        0,
      );
      assert.equal(
        await comments.count({
          where: { postId: post.id, authorId: actor.id },
        }),
        0,
      );
      assert.equal(
        (await posts.findOneByOrFail({ id: post.id })).commentCount,
        0,
      );
    } finally {
      await closeHarness(h);
    }
  },
);

test(
  'the notification reader pages ordinary notifications, returns target identifiers, and filters a malformed cross-class fixture',
  { timeout: TEST_TIMEOUT_MS },
  async () => {
    let h;
    try {
      h = await createHarness();
      const run = randomUUID();
      const users = h.dataSource.getRepository(User);
      const posts = h.dataSource.getRepository(Post);
      const comments = h.dataSource.getRepository(Comment);
      const notifications = h.dataSource.getRepository(Notification);
      const recipient = await users.save(
        fixtureUser('reader-recipient-' + run),
      );
      const actor = await users.save(fixtureUser('reader-actor-' + run));
      const demoActor = await users.save(
        fixtureUser('reader-demo-actor-' + run, { isDemoUser: true }),
      );
      const post = await posts.save({
        authorId: recipient.id,
        content: 'reader notification target',
        likeCount: 0,
        commentCount: 0,
      });

      await h.posts.createComment(actor.id, false, post.id, {
        content: 'reader comment one',
      });
      await h.posts.createComment(actor.id, false, post.id, {
        content: 'reader comment two',
      });
      const expectedComments = await comments.find({
        where: { postId: post.id, authorId: actor.id },
      });
      assert.equal(expectedComments.length, 2);
      // Test-only malformed stored data, not a producer-created event: an
      // ordinary recipient must not read an event with a demo actor.
      await notifications.save({
        recipientId: recipient.id,
        actorId: demoActor.id,
        type: 'follow',
        sourceId: randomUUID(),
      });

      const firstPage = await h.notificationReader.getNotifications(
        recipient.id,
        false,
        { limit: 1 },
      );
      assert.equal(firstPage.items.length, 1);
      assert.ok(firstPage.nextCursor);
      const secondPage = await h.notificationReader.getNotifications(
        recipient.id,
        false,
        { limit: 1, cursor: firstPage.nextCursor },
      );
      assert.equal(secondPage.items.length, 1);
      assert.equal(secondPage.nextCursor, undefined);
      const readItems = [...firstPage.items, ...secondPage.items];
      assert.equal(
        readItems.some((item) => item.actor.id === demoActor.id),
        false,
      );
      assert.deepEqual(
        new Set(readItems.map((item) => item.actor.id)),
        new Set([actor.id]),
      );
      assert.deepEqual(
        new Set(readItems.map((item) => item.postId)),
        new Set([post.id]),
      );
      assert.deepEqual(
        new Set(readItems.map((item) => item.commentId)),
        new Set(expectedComments.map((comment) => comment.id)),
      );
    } finally {
      await closeHarness(h);
    }
  },
);

module.exports = { RETAINED_ROWS_MAX };
