'use strict';
const assert = require('node:assert/strict');
const { openJourneyClient, assertMigrationsCurrent, reportFailure } = require('./sql.cjs');
const { FIXTURE, prepareFixture } = require('./fixture.cjs');
const { loadPrivateEnvironment, commandArguments } = require('./config.cjs');

async function checkFixture() {
  const environment = loadPrivateEnvironment();
  const client = await openJourneyClient();
  try {
    await assertMigrationsCurrent(client);
    const snapshot = async () => (await client.query('SELECT (SELECT count(*)::int FROM public.users) AS users, (SELECT count(*)::int FROM public.posts) AS posts, (SELECT "postsCount" FROM public.users WHERE id=$1) AS author_count', [FIXTURE.userId])).rows[0];
    const before = await snapshot();
    const options = { argon2: require('argon2'), password: environment.ISNTGRAM_JOURNEY_FIXTURE_PASSWORD };
    const first = await prepareFixture(client, options);
    const second = await prepareFixture(client, options);
    assert.deepEqual(first, second);
    assert.deepEqual(await snapshot(), before);
    // A PostgreSQL session-local fixture namespace exercises real SQL rollback without changing public data.
    await client.query('CREATE TEMP TABLE users (LIKE public.users INCLUDING ALL)');
    await client.query('CREATE TEMP TABLE posts (LIKE public.posts INCLUDING ALL)');
    await client.query('INSERT INTO users SELECT * FROM public.users WHERE id=$1', [FIXTURE.userId]);
    await client.query('INSERT INTO posts SELECT * FROM public.posts WHERE id=$1', [FIXTURE.postId]);
    await client.query('UPDATE users SET username=$1 WHERE id=$2', ['journey_conflict_case', FIXTURE.userId]);
    await assert.rejects(() => prepareFixture(client, options), /Fixture conflict: existing user is incompatible/);
    const conflict = await client.query('SELECT username FROM users WHERE id=$1', [FIXTURE.userId]);
    assert.equal(conflict.rows[0].username, 'journey_conflict_case');
    assert.deepEqual(await snapshot(), before);
    return { fixture: FIXTURE.version, userId: FIXTURE.userId, postId: FIXTURE.postId, repeatedIdsMatch: true, publicRowsPreserved: true, conflictRejectedWithoutOverwrite: true, counts: before };
  } finally { await client.end(); }
}

if (require.main === module) {
  Promise.resolve().then(() => { commandArguments(0); return checkFixture(); }).then((result) => console.log(JSON.stringify(result))).catch((error) => reportFailure('PostgreSQL fixture check', error));
}
module.exports = { checkFixture };
