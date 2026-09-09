import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPostMediaAltText1788900000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'posts',
      new TableColumn({
        name: 'mediaAltText',
        type: 'varchar',
        length: '1000',
        isNullable: true,
      }),
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('posts', 'mediaAltText');
  }
}
