import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddTokenVersionToUsers1703123456791 implements MigrationInterface {
  name = 'AddTokenVersionToUsers1703123456791';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'tokenVersion',
        type: 'int',
        default: 0,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'tokenVersion');
  }
}
