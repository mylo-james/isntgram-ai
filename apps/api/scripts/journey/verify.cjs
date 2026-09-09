'use strict';
const { commandArguments } = require('./config.cjs');

const {
  JourneyError,
  openJourneyClient,
  assertMigrationsCurrent,
  reportFailure,
} = require('./sql.cjs');

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** @param {string} postId @param {{query:Function}} client */
async function verifyPost(postId, client) {
  if (!UUID.test(postId))
    throw new JourneyError('Journey verification requires a post UUID');
  await client.query('BEGIN READ ONLY');
  try {
    const result = await client.query(
      'SELECT p.id, p."authorId", p.content, p."createdAt", u.username FROM posts p JOIN users u ON u.id = p."authorId" WHERE p.id = $1',
      [postId],
    );
    if (result.rowCount !== 1)
      throw new JourneyError(
        'Journey verification did not find the requested post',
      );
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function runVerification(postId) {
  if (!UUID.test(postId || ''))
    throw new JourneyError(
      'Supply the exact post UUID from the browser creation response.',
    );
  const client = await openJourneyClient();
  try {
    await assertMigrationsCurrent(client);
    return await verifyPost(postId, client);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  Promise.resolve().then(() => runVerification(commandArguments(1)[0]))
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => reportFailure('verification', error));
}

module.exports = { UUID, verifyPost, runVerification };
