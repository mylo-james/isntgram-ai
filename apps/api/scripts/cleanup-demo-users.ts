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
    const expired = (await queryRunner.query(
      `
        SELECT "id"
        FROM "users"
        WHERE "isDemoUser" = true
          AND "isDemoSeed" = false
          AND "demoExpiresAt" IS NOT NULL
          AND "demoExpiresAt" < NOW();
      `,
    )) as Array<{ id: string }>;

    const expiredIds = expired.map((row) => row.id);
    if (expiredIds.length === 0) {
      await queryRunner.commitTransaction();
      // eslint-disable-next-line no-console
      console.log('✅ No expired demo users to delete');
      return;
    }

    await queryRunner.query(
      `
        DELETE FROM "users"
        WHERE "id" = ANY($1::uuid[]);
      `,
      [expiredIds],
    );

    // Demo isolation guarantees demo users only follow demo users, so counters can be safely reconciled for demo namespace only.
    await queryRunner.query(`
      UPDATE "users" u
      SET "postsCount" = (
        SELECT COUNT(*)::int
        FROM "posts" p
        WHERE p."authorId" = u."id"
      )
      WHERE u."isDemoUser" = true;
    `);

    await queryRunner.query(`
      UPDATE "users" u
      SET "followingCount" = (
        SELECT COUNT(*)::int
        FROM "follows" f
        WHERE f."followerId" = u."id"
      )
      WHERE u."isDemoUser" = true;
    `);

    await queryRunner.query(`
      UPDATE "users" u
      SET "followerCount" = (
        SELECT COUNT(*)::int
        FROM "follows" f
        WHERE f."followingId" = u."id"
      )
      WHERE u."isDemoUser" = true;
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
      )
      WHERE p."authorId" IN (
        SELECT u."id"
        FROM "users" u
        WHERE u."isDemoUser" = true
      );
    `);

    await queryRunner.commitTransaction();
    // eslint-disable-next-line no-console
    console.log(
      `✅ Deleted ${expiredIds.length} expired demo user(s) and reconciled demo counters`,
    );
  } finally {
    await queryRunner.release();
    await dataSource.destroy();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to cleanup demo users:', error);
  process.exit(1);
});
