import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
} from 'typeorm';

export class AddPostEngagementTables1765662512345 implements MigrationInterface {
  name = 'AddPostEngagementTables1765662512345';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('posts', [
      new TableColumn({
        name: 'likesCount',
        type: 'integer',
        default: '0',
        isNullable: false,
      }),
      new TableColumn({
        name: 'commentsCount',
        type: 'integer',
        default: '0',
        isNullable: false,
      }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'post_likes',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'postId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        indices: [
          { columnNames: ['userId'], name: 'IDX_post_likes_userId' },
          { columnNames: ['postId'], name: 'IDX_post_likes_postId' },
        ],
        uniques: [
          {
            columnNames: ['userId', 'postId'],
            name: 'UQ_post_likes_userId_postId',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'post_likes',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'post_likes',
      new TableForeignKey({
        columnNames: ['postId'],
        referencedTableName: 'posts',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
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
            default: 'uuid_generate_v4()',
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
            name: 'text',
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
        indices: [
          { columnNames: ['postId'], name: 'IDX_comments_postId' },
          { columnNames: ['createdAt'], name: 'IDX_comments_createdAt' },
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
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const likesTable = await queryRunner.getTable('post_likes');
    if (likesTable) {
      for (const fk of likesTable.foreignKeys) {
        await queryRunner.dropForeignKey('post_likes', fk);
      }
    }
    await queryRunner.dropTable('post_likes');

    const commentsTable = await queryRunner.getTable('comments');
    if (commentsTable) {
      for (const fk of commentsTable.foreignKeys) {
        await queryRunner.dropForeignKey('comments', fk);
      }
    }
    await queryRunner.dropTable('comments');

    await queryRunner.dropColumn('posts', 'likesCount');
    await queryRunner.dropColumn('posts', 'commentsCount');
  }
}
