import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

const MAX_MEDIA_UPLOAD_BYTES = 5 * 1024 * 1024;

export class AddV1MediaAndNotificationIdentity1788829200000
  implements MigrationInterface
{
  name = 'AddV1MediaAndNotificationIdentity1788829200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'notifications',
      new TableColumn({
        name: 'sourceId',
        type: 'uuid',
        isNullable: true,
      }),
    );
    await queryRunner.createIndex(
      'notifications',
      new TableIndex({
        name: 'UQ_NOTIFICATIONS_TYPE_SOURCE_ID',
        columnNames: ['type', 'sourceId'],
        isUnique: true,
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'media_uploads',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          { name: 'ownerId', type: 'uuid', isNullable: false },
          {
            name: 'pendingKey',
            type: 'varchar',
            length: '1024',
            isNullable: false,
          },
          { name: 'expectedBytes', type: 'integer', isNullable: false },
          {
            name: 'expectedContentType',
            type: 'varchar',
            length: '128',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
          { name: 'expiresAt', type: 'timestamptz', isNullable: false },
          {
            name: 'publishedKey',
            type: 'varchar',
            length: '1024',
            isNullable: true,
          },
          {
            name: 'publishedChecksum',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          {
            name: 'publishedContentType',
            type: 'varchar',
            length: '128',
            isNullable: true,
          },
          { name: 'publishedBytes', type: 'integer', isNullable: true },
          { name: 'postId', type: 'uuid', isNullable: true },
        ],
        checks: [
          {
            name: 'CHK_MEDIA_UPLOADS_EXPECTED_BYTES',
            expression: `"expectedBytes" > 0 AND "expectedBytes" <= ${MAX_MEDIA_UPLOAD_BYTES}`,
          },
          {
            name: 'CHK_MEDIA_UPLOADS_PUBLISHED_BYTES',
            expression: `"publishedBytes" IS NULL OR ("publishedBytes" > 0 AND "publishedBytes" <= ${MAX_MEDIA_UPLOAD_BYTES})`,
          },
        ],
      }),
      true,
    );
    await queryRunner.createForeignKey(
      'media_uploads',
      new TableForeignKey({
        columnNames: ['ownerId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
      }),
    );
    await queryRunner.createForeignKey(
      'media_uploads',
      new TableForeignKey({
        columnNames: ['postId'],
        referencedTableName: 'posts',
        referencedColumnNames: ['id'],
      }),
    );
    await queryRunner.createIndex(
      'media_uploads',
      new TableIndex({
        name: 'IDX_MEDIA_UPLOADS_OWNER',
        columnNames: ['ownerId'],
      }),
    );
    await queryRunner.createIndex(
      'media_uploads',
      new TableIndex({
        name: 'UQ_MEDIA_UPLOADS_PENDING_KEY',
        columnNames: ['pendingKey'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'media_uploads',
      new TableIndex({
        name: 'UQ_MEDIA_UPLOADS_POST_ID',
        columnNames: ['postId'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('media_uploads', true);
    await queryRunner.dropIndex(
      'notifications',
      'UQ_NOTIFICATIONS_TYPE_SOURCE_ID',
    );
    await queryRunner.dropColumn('notifications', 'sourceId');
  }
}
