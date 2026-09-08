'use strict';

const {
  JourneyError,
  openJourneyClient,
  assertMigrationsCurrent,
  reportFailure,
} = require('./sql.cjs');
const { loadPrivateEnvironment, commandArguments } = require('./config.cjs');

const FIXTURE = Object.freeze({
  version: 'isntgram-journey-v1',
  userId: '11111111-0001-4000-8000-000000000001',
  postId: '11111111-0001-4000-8000-000000000002',
  username: 'isntgram_journey_fixture',
  email: 'isntgram-journey-fixture@isntgram.invalid',
  fullName: 'Isntgram Journey Fixture',
  content: 'isntgram-journey-v1 known ordinary fixture post',
  lockKey: 1001001,
});

/** @param {{query:Function}} client @param {{argon2:{argon2id:0|1|2, hash:(password:string, options:{type:0|1|2})=>Promise<string>, verify:(hash:string, password:string)=>Promise<boolean>}, password:string}} dependencies */
async function prepareFixture(client, dependencies) {
  const { argon2, password } = dependencies;
  await client.query('BEGIN');
  try {
    await client.query('SELECT pg_advisory_xact_lock($1)', [FIXTURE.lockKey]);
    const user = await client.query(
      'SELECT id, username, email, "hashedPassword", "isDemoUser", "isDemoSeed", "demoExpiresAt" FROM users WHERE id = $1 OR username = $2 OR email = $3 FOR UPDATE',
      [FIXTURE.userId, FIXTURE.username, FIXTURE.email],
    );
    if (user.rowCount > 1)
      throw new JourneyError(
        'Fixture conflict: reserved identities resolve to different rows',
      );
    if (user.rowCount === 0) {
      const hash = await argon2.hash(password, { type: argon2.argon2id });
      await client.query(
        'INSERT INTO users (id, username, "fullName", email, "hashedPassword", "tokenVersion", "isDemoUser", "isDemoSeed", "postsCount", "followerCount", "followingCount") VALUES ($1,$2,$3,$4,$5,0,false,false,0,0,0)',
        [
          FIXTURE.userId,
          FIXTURE.username,
          FIXTURE.fullName,
          FIXTURE.email,
          hash,
        ],
      );
    } else {
      const row = user.rows[0];
      if (
        row.id !== FIXTURE.userId ||
        row.username !== FIXTURE.username ||
        row.email !== FIXTURE.email ||
        row.isDemoUser ||
        row.isDemoSeed ||
        row.demoExpiresAt !== null ||
        !row.hashedPassword.startsWith('$argon2id$') ||
        !(await argon2.verify(row.hashedPassword, password))
      )
        throw new JourneyError(
          'Fixture conflict: existing user is incompatible',
        );
    }
    const post = await client.query(
      'SELECT id, "authorId", content, "mediaUrl" FROM posts WHERE id = $1 OR ("authorId" = $2 AND content = $3) FOR UPDATE',
      [FIXTURE.postId, FIXTURE.userId, FIXTURE.content],
    );
    if (post.rowCount > 1)
      throw new JourneyError(
        'Fixture conflict: reserved post identities resolve to different rows',
      );
    if (post.rowCount === 0) {
      await client.query(
        'INSERT INTO posts (id, "authorId", content, "mediaUrl", "likeCount", "commentCount") VALUES ($1,$2,$3,NULL,0,0)',
        [FIXTURE.postId, FIXTURE.userId, FIXTURE.content],
      );
      await client.query(
        'UPDATE users SET "postsCount" = "postsCount" + 1 WHERE id = $1',
        [FIXTURE.userId],
      );
    } else {
      const row = post.rows[0];
      if (
        row.id !== FIXTURE.postId ||
        row.authorId !== FIXTURE.userId ||
        row.content !== FIXTURE.content ||
        row.mediaUrl !== null
      )
        throw new JourneyError(
          'Fixture conflict: existing post is incompatible',
        );
    }
    await client.query('COMMIT');
    return {
      userId: FIXTURE.userId,
      postId: FIXTURE.postId,
      version: FIXTURE.version,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function runFixtureCommand() {
  const environment = loadPrivateEnvironment();
  const client = await openJourneyClient();
  try {
    await assertMigrationsCurrent(client);
    return await prepareFixture(client, {
      argon2: require('argon2'),
      password: environment.ISNTGRAM_JOURNEY_FIXTURE_PASSWORD,
    });
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  Promise.resolve().then(() => { commandArguments(0); return runFixtureCommand(); })
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => reportFailure('fixture', error));
}

module.exports = { FIXTURE, prepareFixture, runFixtureCommand };
