import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class AddFollowCompositeIndexes1766349000000
  implements MigrationInterface
{
  name = 'AddFollowCompositeIndexes1766349000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const followsTable = await queryRunner.getTable('follows');
    const existingIndexNames = new Set(
      followsTable?.indices.map((index) => index.name) ?? [],
    );

    if (existingIndexNames.has('IDX_FOLLOWS_FOLLOWER')) {
      await queryRunner.dropIndex('follows', 'IDX_FOLLOWS_FOLLOWER');
    }

    if (existingIndexNames.has('IDX_FOLLOWS_FOLLOWING')) {
      await queryRunner.dropIndex('follows', 'IDX_FOLLOWS_FOLLOWING');
    }

    if (!existingIndexNames.has('IDX_FOLLOWS_FOLLOWER_CREATED_AT')) {
      await queryRunner.createIndex(
        'follows',
        new TableIndex({
          name: 'IDX_FOLLOWS_FOLLOWER_CREATED_AT',
          columnNames: ['followerId', 'createdAt'],
        }),
      );
    }

    if (!existingIndexNames.has('IDX_FOLLOWS_FOLLOWING_CREATED_AT')) {
      await queryRunner.createIndex(
        'follows',
        new TableIndex({
          name: 'IDX_FOLLOWS_FOLLOWING_CREATED_AT',
          columnNames: ['followingId', 'createdAt'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const followsTable = await queryRunner.getTable('follows');
    const existingIndexNames = new Set(
      followsTable?.indices.map((index) => index.name) ?? [],
    );

    if (existingIndexNames.has('IDX_FOLLOWS_FOLLOWING_CREATED_AT')) {
      await queryRunner.dropIndex(
        'follows',
        'IDX_FOLLOWS_FOLLOWING_CREATED_AT',
      );
    }

    if (existingIndexNames.has('IDX_FOLLOWS_FOLLOWER_CREATED_AT')) {
      await queryRunner.dropIndex('follows', 'IDX_FOLLOWS_FOLLOWER_CREATED_AT');
    }

    if (!existingIndexNames.has('IDX_FOLLOWS_FOLLOWER')) {
      await queryRunner.createIndex(
        'follows',
        new TableIndex({
          name: 'IDX_FOLLOWS_FOLLOWER',
          columnNames: ['followerId'],
        }),
      );
    }

    if (!existingIndexNames.has('IDX_FOLLOWS_FOLLOWING')) {
      await queryRunner.createIndex(
        'follows',
        new TableIndex({
          name: 'IDX_FOLLOWS_FOLLOWING',
          columnNames: ['followingId'],
        }),
      );
    }
  }
}
