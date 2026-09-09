import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/** Durable operation evidence belongs to the deployment environment, never a
 * user record. It lets admission fail closed after a missed cleanup run. */
export class AddDeploymentMaintenanceState1790000001000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'deployment_maintenance_state',
        columns: [
          { name: 'environment', type: 'varchar', length: '64', isPrimary: true },
          { name: 'cleanup_last_succeeded_at', type: 'timestamptz', isNullable: true },
          { name: 'cleanup_last_failed_at', type: 'timestamptz', isNullable: true },
          { name: 'cleanup_last_error', type: 'text', isNullable: true },
          { name: 'updated_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );
    await queryRunner.createTable(
      new Table({
        name: 'media_deletion_intents',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
          { name: 'environment', type: 'varchar', length: '64' },
          { name: 'upload_id', type: 'uuid', isNullable: true },
          { name: 'bucket_kind', type: 'varchar', length: '16' },
          { name: 'object_key', type: 'varchar', length: '1024' },
          { name: 'reason', type: 'varchar', length: '64' },
          { name: 'attempts', type: 'integer', default: '0' },
          { name: 'completed_at', type: 'timestamptz', isNullable: true },
          { name: 'last_error', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
        ],
        checks: [
          { name: 'CHK_MEDIA_DELETION_BUCKET_KIND', expression: `"bucket_kind" IN ('pending', 'published')` },
          { name: 'CHK_MEDIA_DELETION_KEY_PREFIX', expression: `("bucket_kind" = 'pending' AND "object_key" LIKE 'pending/%') OR ("bucket_kind" = 'published' AND "object_key" LIKE 'published/%')` },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'media_deletion_intents',
      new TableIndex({
        name: 'UQ_MEDIA_DELETION_INTENTS_ENV_KEY',
        columnNames: ['environment', 'bucket_kind', 'object_key'],
        isUnique: true,
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('media_deletion_intents', true);
    await queryRunner.dropTable('deployment_maintenance_state', true);
  }
}
