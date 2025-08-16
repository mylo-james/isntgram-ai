import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class CreateFollowsTable1703123456790 implements MigrationInterface {
  name = 'CreateFollowsTable1703123456790';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'follows',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
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
            columnNames: ['followerId', 'followingId'],
            name: 'UQ_follower_following',
          },
        ],
        indices: [
          {
            columnNames: ['followerId'],
            name: 'IDX_follower',
          },
          {
            columnNames: ['followingId'],
            name: 'IDX_following',
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop constraints first
    const table = await queryRunner.getTable('follows');
    if (table) {
      const foreignKeys = table.foreignKeys.filter((fk) =>
        ['followerId', 'followingId'].includes(fk.columnNames[0]),
      );
      for (const fk of foreignKeys) {
        await queryRunner.dropForeignKey('follows', fk);
      }
    }

    await queryRunner.dropTable('follows');
  }
}
