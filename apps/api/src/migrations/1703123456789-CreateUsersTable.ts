import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateUsersTable1703123456789 implements MigrationInterface {
  name = 'CreateUsersTable1703123456789';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'username',
            type: 'varchar',
            length: '50',
            isUnique: true,
          },
          {
            name: 'fullName',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
            isUnique: true,
          },
          {
            name: 'hashedPassword',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'profilePictureUrl',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'bio',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'postsCount',
            type: 'int',
            default: 0,
          },
          {
            name: 'followerCount',
            type: 'int',
            default: 0,
          },
          {
            name: 'followingCount',
            type: 'int',
            default: 0,
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

    // Create indexes using raw SQL to avoid TypeScript issues
    await queryRunner.query(
      'CREATE INDEX "IDX_USERS_EMAIL" ON "users" ("email")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_USERS_USERNAME" ON "users" ("username")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_USERS_CREATED_AT" ON "users" ("createdAt")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query('DROP INDEX "IDX_USERS_CREATED_AT"');
    await queryRunner.query('DROP INDEX "IDX_USERS_USERNAME"');
    await queryRunner.query('DROP INDEX "IDX_USERS_EMAIL"');

    // Drop table
    await queryRunner.dropTable('users');
  }
}
