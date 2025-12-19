import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreatePostsAndFollows1703123456790 implements MigrationInterface {
  name = 'CreatePostsAndFollows1703123456790';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    await queryRunner.createTable(
      new Table({
        name: 'posts',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'authorId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'content',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'mediaUrl',
            type: 'varchar',
            length: '1000',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'posts',
      new TableForeignKey({
        columnNames: ['authorId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'posts',
      new TableIndex({
        name: 'IDX_POSTS_AUTHOR_CREATED_AT',
        columnNames: ['authorId', 'createdAt'],
      }),
    );

    await queryRunner.createIndex(
      'posts',
      new TableIndex({
        name: 'IDX_POSTS_CREATED_AT',
        columnNames: ['createdAt'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'follows',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'followerId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'followingId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        uniques: [
          {
            name: 'UQ_FOLLOWS_FOLLOWER_FOLLOWING',
            columnNames: ['followerId', 'followingId'],
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'follows',
      new TableForeignKey({
        columnNames: ['followerId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'follows',
      new TableForeignKey({
        columnNames: ['followingId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('follows', 'IDX_FOLLOWS_FOLLOWING');
    await queryRunner.dropIndex('follows', 'IDX_FOLLOWS_FOLLOWER');

    const followsTable = await queryRunner.getTable('follows');
    if (followsTable) {
      for (const foreignKey of followsTable.foreignKeys) {
        await queryRunner.dropForeignKey('follows', foreignKey);
      }
    }

    await queryRunner.dropTable('follows');

    await queryRunner.dropIndex('posts', 'IDX_POSTS_CREATED_AT');
    await queryRunner.dropIndex('posts', 'IDX_POSTS_AUTHOR_CREATED_AT');

    const postsTable = await queryRunner.getTable('posts');
    if (postsTable) {
      for (const foreignKey of postsTable.foreignKeys) {
        await queryRunner.dropForeignKey('posts', foreignKey);
      }
    }

    await queryRunner.dropTable('posts');
  }
}
