import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddProfilePictureMediaBinding1788910000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'media_uploads',
      new TableColumn({
        name: 'profilePictureUserId',
        type: 'uuid',
        isNullable: true,
      }),
    );
    await queryRunner.createForeignKey(
      'media_uploads',
      new TableForeignKey({
        columnNames: ['profilePictureUserId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
      }),
    );
    await queryRunner.createIndex(
      'media_uploads',
      new TableIndex({
        name: 'IDX_MEDIA_UPLOADS_PROFILE_PICTURE_USER',
        columnNames: ['profilePictureUserId'],
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'media_uploads',
      'IDX_MEDIA_UPLOADS_PROFILE_PICTURE_USER',
    );
    const table = await queryRunner.getTable('media_uploads');
    const foreignKey = table?.foreignKeys.find((key) =>
      key.columnNames.includes('profilePictureUserId'),
    );
    if (foreignKey)
      await queryRunner.dropForeignKey('media_uploads', foreignKey);
    await queryRunner.dropColumn('media_uploads', 'profilePictureUserId');
  }
}
