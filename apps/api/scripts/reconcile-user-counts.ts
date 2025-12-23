import dataSource from '../ormconfig';

async function main() {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  if (
    nodeEnv === 'production' &&
    process.env.ALLOW_PROD_MAINTENANCE !== 'true'
  ) {
    throw new Error(
      'Refusing to run in production without ALLOW_PROD_MAINTENANCE=true',
    );
  }

  await dataSource.initialize();

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    await queryRunner.query(`
      UPDATE "users" u
      SET "postsCount" = (
        SELECT COUNT(*)::int
        FROM "posts" p
        WHERE p."authorId" = u."id"
      );
    `);

    await queryRunner.query(`
      UPDATE "users" u
      SET "followingCount" = (
        SELECT COUNT(*)::int
        FROM "follows" f
        WHERE f."followerId" = u."id"
      );
    `);

    await queryRunner.query(`
      UPDATE "users" u
      SET "followerCount" = (
        SELECT COUNT(*)::int
        FROM "follows" f
        WHERE f."followingId" = u."id"
      );
    `);

    await queryRunner.query(`
      UPDATE "posts" p
      SET "likeCount" = (
        SELECT COUNT(*)::int
        FROM "likes" l
        WHERE l."postId" = p."id"
      ),
      "commentCount" = (
        SELECT COUNT(*)::int
        FROM "comments" c
        WHERE c."postId" = p."id"
      );
    `);

    await queryRunner.commitTransaction();
    // eslint-disable-next-line no-console
    console.log(
      '✅ Reconciled counters (users: posts/followers/following, posts: likes/comments)',
    );
  } finally {
    await queryRunner.release();
    await dataSource.destroy();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to reconcile user counters:', error);
  process.exit(1);
});
