import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddDemoUserFields1766347800000 implements MigrationInterface {
  name = 'AddDemoUserFields1766347800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('users', [
      new TableColumn({
        name: 'isDemoUser',
        type: 'boolean',
        default: false,
      }),
      new TableColumn({
        name: 'isDemoSeed',
        type: 'boolean',
        default: false,
      }),
      new TableColumn({
        name: 'demoExpiresAt',
        type: 'timestamp',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'demoExpiresAt');
    await queryRunner.dropColumn('users', 'isDemoSeed');
    await queryRunner.dropColumn('users', 'isDemoUser');
  }
}
