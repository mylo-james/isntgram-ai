import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeploymentTarget1790000002000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE deployment_target (
      singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
      target_id uuid NOT NULL UNIQUE,
      environment varchar(64) NOT NULL,
      pending_bucket varchar(255) NOT NULL,
      published_bucket varchar(255) NOT NULL,
      backup_bucket varchar(255) NOT NULL,
      CHECK (pending_bucket <> published_bucket AND pending_bucket <> backup_bucket AND published_bucket <> backup_bucket)
    )`);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE deployment_target');
  }
}
