import { DataSource, QueryRunner, Table, TableIndex } from 'typeorm';
import { CreatePostsAndFollows1703123456790 } from '../src/migrations/1703123456790-CreatePostsAndFollows';
import { AddLikesAndComments1766348400000 } from '../src/migrations/1766348400000-AddLikesAndComments';
import { AddFollowCompositeIndexes1766349000000 } from '../src/migrations/1766349000000-AddFollowCompositeIndexes';

async function createSqliteSchema(): Promise<{
  dataSource: DataSource;
  queryRunner: QueryRunner;
}> {
  const dataSource = new DataSource({ type: 'sqlite', database: ':memory:' });
  await dataSource.initialize();
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.createTable(
    new Table({
      name: 'users',
      columns: [{ name: 'id', type: 'varchar', isPrimary: true }],
    }),
  );
  return { dataSource, queryRunner };
}

async function destroy(dataSource: DataSource, queryRunner: QueryRunner) {
  await queryRunner.release();
  await dataSource.destroy();
}

describe('migration schema behavior in isolated SQLite', () => {
  it('removes posts and follows plus their indexes on down', async () => {
    const { dataSource, queryRunner } = await createSqliteSchema();
    const migration = new CreatePostsAndFollows1703123456790();
    const originalQuery = queryRunner.query.bind(queryRunner);
    jest
      .spyOn(queryRunner, 'query')
      .mockImplementation(async (query, parameters) => {
        if (query === 'CREATE EXTENSION IF NOT EXISTS "pgcrypto"') return [];
        return originalQuery(query, parameters);
      });

    try {
      await migration.up(queryRunner);
      expect(await queryRunner.hasTable('posts')).toBe(true);
      expect(await queryRunner.hasTable('follows')).toBe(true);
      expect(
        (await queryRunner.getTable('posts'))?.indices.map(
          (index) => index.name,
        ),
      ).toEqual(
        expect.arrayContaining([
          'IDX_POSTS_AUTHOR_CREATED_AT',
          'IDX_POSTS_CREATED_AT',
        ]),
      );
      expect(
        (await queryRunner.getTable('follows'))?.indices.map(
          (index) => index.name,
        ),
      ).toEqual(
        expect.arrayContaining([
          'IDX_FOLLOWS_FOLLOWER',
          'IDX_FOLLOWS_FOLLOWING',
        ]),
      );

      await migration.down(queryRunner);

      expect(await queryRunner.hasTable('posts')).toBe(false);
      expect(await queryRunner.hasTable('follows')).toBe(false);
    } finally {
      await destroy(dataSource, queryRunner);
    }
  });

  it('adds like and comment counters, relational uniqueness, and removes them on down', async () => {
    const { dataSource, queryRunner } = await createSqliteSchema();
    const migration = new AddLikesAndComments1766348400000();
    await queryRunner.createTable(
      new Table({
        name: 'posts',
        columns: [{ name: 'id', type: 'varchar', isPrimary: true }],
      }),
    );

    try {
      await migration.up(queryRunner);
      await queryRunner.query("INSERT INTO users (id) VALUES ('user-1')");
      await queryRunner.query("INSERT INTO posts (id) VALUES ('post-1')");
      await queryRunner.query(
        "INSERT INTO likes (id, postId, userId) VALUES ('like-1', 'post-1', 'user-1')",
      );

      await expect(
        queryRunner.query(
          "INSERT INTO likes (id, postId, userId) VALUES ('like-2', 'post-1', 'user-1')",
        ),
      ).rejects.toThrow();
      await expect(
        queryRunner.query(
          "INSERT INTO comments (id, postId, authorId, content) VALUES ('comment-1', 'missing', 'user-1', 'x')",
        ),
      ).rejects.toThrow();
      expect(
        (await queryRunner.getTable('posts'))?.findColumnByName('likeCount'),
      ).toBeDefined();
      expect(
        (await queryRunner.getTable('posts'))?.findColumnByName('commentCount'),
      ).toBeDefined();

      await migration.down(queryRunner);

      expect(await queryRunner.hasTable('likes')).toBe(false);
      expect(await queryRunner.hasTable('comments')).toBe(false);
      expect(
        (await queryRunner.getTable('posts'))?.findColumnByName('likeCount'),
      ).toBeUndefined();
      expect(
        (await queryRunner.getTable('posts'))?.findColumnByName('commentCount'),
      ).toBeUndefined();
    } finally {
      await destroy(dataSource, queryRunner);
    }
  });

  it('replaces the single-column follow indexes with composite indexes and restores them on down', async () => {
    const { dataSource, queryRunner } = await createSqliteSchema();
    const migration = new AddFollowCompositeIndexes1766349000000();
    await queryRunner.createTable(
      new Table({
        name: 'follows',
        columns: [
          { name: 'id', type: 'varchar', isPrimary: true },
          { name: 'followerId', type: 'varchar' },
          { name: 'followingId', type: 'varchar' },
          { name: 'createdAt', type: 'datetime' },
        ],
      }),
    );
    await queryRunner.createIndex(
      'follows',
      new TableIndex({
        name: 'IDX_FOLLOWS_FOLLOWER',
        columnNames: ['followerId'],
      }),
    );
    await queryRunner.createIndex(
      'follows',
      new TableIndex({
        name: 'IDX_FOLLOWS_FOLLOWING',
        columnNames: ['followingId'],
      }),
    );

    try {
      await migration.up(queryRunner);
      const afterUp = await queryRunner.getTable('follows');
      expect(afterUp?.indices.map((index) => index.name)).toEqual(
        expect.arrayContaining([
          'IDX_FOLLOWS_FOLLOWER_CREATED_AT',
          'IDX_FOLLOWS_FOLLOWING_CREATED_AT',
        ]),
      );
      expect(afterUp?.indices.map((index) => index.name)).not.toEqual(
        expect.arrayContaining([
          'IDX_FOLLOWS_FOLLOWER',
          'IDX_FOLLOWS_FOLLOWING',
        ]),
      );

      await migration.up(queryRunner);

      await migration.down(queryRunner);
      await migration.down(queryRunner);
      const afterDown = await queryRunner.getTable('follows');
      expect(afterDown?.indices.map((index) => index.name)).toEqual(
        expect.arrayContaining([
          'IDX_FOLLOWS_FOLLOWER',
          'IDX_FOLLOWS_FOLLOWING',
        ]),
      );
      expect(afterDown?.indices.map((index) => index.name)).not.toEqual(
        expect.arrayContaining([
          'IDX_FOLLOWS_FOLLOWER_CREATED_AT',
          'IDX_FOLLOWS_FOLLOWING_CREATED_AT',
        ]),
      );
    } finally {
      await destroy(dataSource, queryRunner);
    }
  });
});
