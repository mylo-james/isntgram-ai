import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddLikesAndComments1766348400000 implements MigrationInterface {
  name = 'AddLikesAndComments1766348400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('posts', [
      new TableColumn({
        name: 'likeCount',
        type: 'integer',
        default: 0,
      }),
      new TableColumn({
        name: 'commentCount',
        type: 'integer',
        default: 0,
      }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'likes',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'postId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'userId',
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
            name: 'UQ_LIKES_POST_USER',
            columnNames: ['postId', 'userId'],
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'likes',
      new TableForeignKey({
        columnNames: ['postId'],
        referencedTableName: 'posts',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'likes',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'likes',
      new TableIndex({
        name: 'IDX_LIKES_POST_CREATED_AT',
        columnNames: ['postId', 'createdAt'],
      }),
    );

    await queryRunner.createIndex(
      'likes',
      new TableIndex({
        name: 'IDX_LIKES_USER_CREATED_AT',
        columnNames: ['userId', 'createdAt'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'comments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'postId',
            type: 'uuid',
            isNullable: false,
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
      'comments',
      new TableForeignKey({
        columnNames: ['postId'],
        referencedTableName: 'posts',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'comments',
      new TableForeignKey({
        columnNames: ['authorId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'comments',
      new TableIndex({
        name: 'IDX_COMMENTS_POST_CREATED_AT',
        columnNames: ['postId', 'createdAt'],
      }),
    );

    await queryRunner.createIndex(
      'comments',
      new TableIndex({
        name: 'IDX_COMMENTS_AUTHOR_CREATED_AT',
        columnNames: ['authorId', 'createdAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('comments', 'IDX_COMMENTS_AUTHOR_CREATED_AT');
    await queryRunner.dropIndex('comments', 'IDX_COMMENTS_POST_CREATED_AT');

    const commentsTable = await queryRunner.getTable('comments');
    if (commentsTable) {
      for (const foreignKey of commentsTable.foreignKeys) {
        await queryRunner.dropForeignKey('comments', foreignKey);
      }
    }
    await queryRunner.dropTable('comments');

    await queryRunner.dropIndex('likes', 'IDX_LIKES_USER_CREATED_AT');
    await queryRunner.dropIndex('likes', 'IDX_LIKES_POST_CREATED_AT');

    const likesTable = await queryRunner.getTable('likes');
    if (likesTable) {
      for (const foreignKey of likesTable.foreignKeys) {
        await queryRunner.dropForeignKey('likes', foreignKey);
      }
    }
    await queryRunner.dropTable('likes');

    await queryRunner.dropColumn('posts', 'commentCount');
    await queryRunner.dropColumn('posts', 'likeCount');
  }
}
