'use strict';

require('reflect-metadata');

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const test = require('node:test');
const { ConflictException, NotFoundException } = require('@nestjs/common');
const { DataSource } = require('typeorm');
const config = require('../scripts/v1/config.cjs');
const preflight = require('../scripts/v1/preflight.cjs');
const { User } = require('../dist/users/entities/user.entity');
const { Post } = require('../dist/posts/entities/post.entity');
const { Like } = require('../dist/posts/entities/like.entity');
const { Comment } = require('../dist/posts/entities/comment.entity');
const { CommentLike } = require('../dist/posts/entities/comment-like.entity');
const { Follow } = require('../dist/follows/entities/follow.entity');
const { Notification } = require('../dist/notifications/entities/notification.entity');
const { MediaUpload } = require('../dist/media/entities/media-upload.entity');
const { PostsService } = require('../dist/posts/posts.service');
const { NotificationsWriter } = require('../dist/notifications/notifications.writer');

const TEST_TIMEOUT_MS = 10_000;
// This file retains at most 15 rows: five owner/upload/post groups. Together with
// the existing 63-row native suite and its 100-row reserve, this remains below 1000.
const RETAINED_ROWS_MAX = 15;

function fixtureUser(suffix) {
  return {
    username: `v1_media_${suffix}`.slice(0, 50),
    fullName: `V1 media ${suffix}`,
    email: `v1-media-${suffix}@example.invalid`,
    hashedPassword: 'test-only-hash',
    isDemoUser: false,
    isDemoSeed: false,
    postsCount: 0,
    followerCount: 0,
    followingCount: 0,
  };
}
function assertProductionEnvironment() {
  assert.equal(process.env.NODE_ENV, 'production');
}
function prepared(upload) {
  const publishedKey = `published/${upload.ownerId}/${randomUUID()}`;
  return {
    uploadId: upload.id,
    ownerId: upload.ownerId,
    publishedKey,
    publishedUrl: `http://127.0.0.1:48333/isntgram-v1-media/${publishedKey}`,
    checksum: 'a'.repeat(64),
    contentType: 'image/jpeg',
    bytes: 512,
    width: 16,
    height: 12,
    frames: 1,
  };
}
function mediaFake(dataSource, behavior = {}) {
  const orphans = [];
  const preparedValues = [];
  return {
    orphans, preparedValues,
    toDisplayUrl(value) { return value; },
    async getOwnedUpload(ownerId, uploadId) {
      const upload = await dataSource.getRepository(MediaUpload).findOneBy({ id: uploadId, ownerId });
      if (!upload) throw new NotFoundException('Upload not found');
      return upload;
    },
    async preparePublication(ownerId, uploadId) {
      const upload = await this.getOwnedUpload(ownerId, uploadId);
      if (upload.expiresAt.getTime() <= Date.now()) throw new ConflictException('Upload expired');
      if (behavior.expireDuringPrepare)
        await dataSource.getRepository(MediaUpload).update({ id: upload.id }, { expiresAt: new Date(0) });
      if (behavior.barrier) await behavior.barrier.wait();
      const value = prepared(upload);
      preparedValues.push(value);
      return value;
    },
    recordOrphan(value, reason) {
      orphans.push({ uploadId: value.uploadId, reason, publishedKey: value.publishedKey });
    },
  };
}
async function createHarness(behavior) {
  assertProductionEnvironment();
  const c = config.load();
  const verified = await preflight.connect(c, 'test');
  await verified.end();
  const database = config.database(c, 'test');
  const dataSource = new DataSource({
    type: 'postgres', host: database.host, port: database.port,
    username: database.user, password: database.password, database: database.database,
    ssl: false, synchronize: false, logging: false, connectTimeoutMS: 5000,
    extra: { statement_timeout: 5000, lock_timeout: 5000 },
    entities: [User, Post, Like, Comment, CommentLike, Follow, Notification, MediaUpload],
  });
  await dataSource.initialize();
  const media = mediaFake(dataSource, behavior);
  const posts = new PostsService(
    dataSource.getRepository(Post), dataSource.getRepository(Like),
    dataSource.getRepository(Comment), dataSource.getRepository(CommentLike),
    dataSource.getRepository(Follow), dataSource.getRepository(User), dataSource,
    media, new NotificationsWriter(),
  );
  return { dataSource, posts, media };
}
async function closeHarness(harness) {
  if (harness?.dataSource?.isInitialized) await harness.dataSource.destroy();
}
async function ownerAndUpload(harness, suffix, expiresAt = new Date(Date.now() + 60_000)) {
  const owner = await harness.dataSource.getRepository(User).save(fixtureUser(suffix));
  const upload = await harness.dataSource.getRepository(MediaUpload).save({
    ownerId: owner.id, pendingKey: `pending/${owner.id}/${randomUUID()}`,
    expectedBytes: 512, expectedContentType: 'image/jpeg', expiresAt,
  });
  return { owner, upload };
}

function twoPartyBarrier() {
  let arrived = 0;
  let release;
  const released = new Promise((resolve) => { release = resolve; });
  return {
    async wait() {
      arrived += 1;
      if (arrived === 2) release();
      await released;
    },
    get arrived() { return arrived; },
  };
}
async function assertUnbound(harness, owner, upload) {
  const storedUpload = await harness.dataSource.getRepository(MediaUpload).findOneByOrFail({ id: upload.id });
  const storedOwner = await harness.dataSource.getRepository(User).findOneByOrFail({ id: owner.id });
  assert.equal(storedUpload.postId, null);
  assert.equal(storedUpload.publishedKey, null);
  assert.equal(storedUpload.publishedChecksum, null);
  assert.equal(storedUpload.publishedContentType, null);
  assert.equal(storedUpload.publishedBytes, null);
  assert.equal(storedOwner.postsCount, 0);
}

test('media upload binds once, replays same content, and rejects changed content', { timeout: TEST_TIMEOUT_MS }, async () => {
  let h;
  try {
    h = await createHarness();
    const { owner, upload } = await ownerAndUpload(h, randomUUID());
    const first = await h.posts.createPost(owner.id, { content: 'same content', mediaUploadId: upload.id });
    const replay = await h.posts.createPost(owner.id, { content: 'same content', mediaUploadId: upload.id });
    assert.equal(replay.id, first.id);
    await assert.rejects(
      h.posts.createPost(owner.id, { content: 'changed content', mediaUploadId: upload.id }),
      ConflictException,
    );
    const bound = await h.dataSource.getRepository(MediaUpload).findOneByOrFail({ id: upload.id });
    assert.equal(bound.postId, first.id);
    assert.equal(await h.dataSource.getRepository(Post).count({ where: { authorId: owner.id } }), 1);
  } finally { await closeHarness(h); }
});

test('barriered concurrent preparation loses one conditional claim and replays one binding', { timeout: TEST_TIMEOUT_MS }, async () => {
  let h;
  try {
    const barrier = twoPartyBarrier();
    h = await createHarness({ barrier });
    const { owner, upload } = await ownerAndUpload(h, randomUUID());
    const results = await Promise.all([
      h.posts.createPost(owner.id, { content: 'concurrent content', mediaUploadId: upload.id }),
      h.posts.createPost(owner.id, { content: 'concurrent content', mediaUploadId: upload.id }),
    ]);
    assert.equal(barrier.arrived, 2);
    assert.equal(results[0].id, results[1].id);
    assert.equal(await h.dataSource.getRepository(Post).count({ where: { authorId: owner.id } }), 1);
    const bound = await h.dataSource.getRepository(MediaUpload).findOneByOrFail({ id: upload.id });
    const storedOwner = await h.dataSource.getRepository(User).findOneByOrFail({ id: owner.id });
    assert.equal(storedOwner.postsCount, 1);
    assert.equal(h.media.orphans.length, 1);
    assert.equal(h.media.orphans[0].uploadId, upload.id);
    assert.equal(h.media.orphans[0].reason, 'post_transaction_failed');
    assert.notEqual(h.media.orphans[0].publishedKey, bound.publishedKey);
    assert.ok(h.media.preparedValues.some((value) => value.publishedKey === bound.publishedKey));
    assert.equal(bound.publishedChecksum, 'a'.repeat(64));
    assert.equal(bound.publishedContentType, 'image/jpeg');
    assert.equal(bound.publishedBytes, 512);
  } finally { await closeHarness(h); }
});

test('wrong owner and expired intent create no post or binding', { timeout: TEST_TIMEOUT_MS }, async () => {
  let h;
  try {
    h = await createHarness();
    const { upload } = await ownerAndUpload(h, randomUUID());
    const other = await h.dataSource.getRepository(User).save(fixtureUser(randomUUID()));
    await assert.rejects(h.posts.createPost(other.id, { content: 'wrong owner', mediaUploadId: upload.id }), NotFoundException);
    const expired = await ownerAndUpload(h, randomUUID(), new Date(0));
    await assert.rejects(h.posts.createPost(expired.owner.id, { content: 'expired', mediaUploadId: expired.upload.id }), ConflictException);
    await assertUnbound(h, (await h.dataSource.getRepository(User).findOneByOrFail({ id: upload.ownerId })), upload);
    await assertUnbound(h, expired.owner, expired.upload);
    assert.equal(await h.dataSource.getRepository(Post).count({ where: { authorId: other.id } }), 0);
  } finally { await closeHarness(h); }
});

test('expiry during preparation loses the conditional claim and retains an orphan record', { timeout: TEST_TIMEOUT_MS }, async () => {
  let h;
  try {
    h = await createHarness({ expireDuringPrepare: true });
    const { owner, upload } = await ownerAndUpload(h, randomUUID());
    await assert.rejects(h.posts.createPost(owner.id, { content: 'expires mid-flight', mediaUploadId: upload.id }), ConflictException);
    assert.equal(await h.dataSource.getRepository(Post).count({ where: { authorId: owner.id } }), 0);
    await assertUnbound(h, owner, upload);
    assert.equal(h.media.orphans.length, 1);
    assert.equal(h.media.orphans[0].uploadId, upload.id);
    assert.equal(h.media.orphans[0].reason, 'post_transaction_failed');
  } finally { await closeHarness(h); }
});

test('failed user counter update rolls back post and upload binding while retaining orphan evidence', { timeout: TEST_TIMEOUT_MS }, async () => {
  let h;
  try {
    h = await createHarness();
    const { owner, upload } = await ownerAndUpload(h, randomUUID());
    const original = h.dataSource.transaction.bind(h.dataSource);
    h.posts.dataSource = {
      transaction: (work) => original((manager) => work(new Proxy(manager, {
        get(target, key, receiver) {
          if (key !== 'getRepository') return Reflect.get(target, key, receiver);
          return (entity) => entity === User ? { ...target.getRepository(entity), increment: async () => { throw new Error('counter write failed'); } } : target.getRepository(entity);
        },
      }))),
    };
    await assert.rejects(h.posts.createPost(owner.id, { content: 'counter fails', mediaUploadId: upload.id }), /counter write failed/);
    assert.equal(await h.dataSource.getRepository(Post).count({ where: { authorId: owner.id } }), 0);
    await assertUnbound(h, owner, upload);
    assert.equal(h.media.orphans.length, 1);
  } finally { await closeHarness(h); }
});

module.exports = { RETAINED_ROWS_MAX };
