import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeploymentAdmission1790000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE deployment_admission_windows (
      environment varchar(32) NOT NULL,
      scope varchar(64) NOT NULL,
      subject varchar(255) NOT NULL,
      window_starts_at timestamptz NOT NULL,
      count integer NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT NOW(),
      PRIMARY KEY (environment, scope, subject, window_starts_at)
    )`);
    await queryRunner.query(`CREATE TABLE deployment_operation_leases (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      environment varchar(32) NOT NULL,
      kind varchar(64) NOT NULL,
      subject varchar(255) NOT NULL,
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      UNIQUE (environment, kind, subject)
    )`);
    await queryRunner.query('CREATE INDEX IDX_DEPLOYMENT_OPERATION_LEASES_ACTIVE ON deployment_operation_leases (environment, kind, expires_at)');
    await queryRunner.query(`CREATE TABLE deployment_upload_reservations (
      environment varchar(32) NOT NULL,
      upload_id uuid NOT NULL,
      user_id uuid NOT NULL,
      bytes bigint NOT NULL CHECK (bytes > 0),
      state varchar(16) NOT NULL CHECK (state IN ('reserved', 'complete', 'released')),
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW(),
      PRIMARY KEY (environment, upload_id)
    )`);
    await queryRunner.query('CREATE INDEX IDX_DEPLOYMENT_UPLOAD_RESERVATIONS_LIVE ON deployment_upload_reservations (environment, state, expires_at)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS deployment_upload_reservations');
    await queryRunner.query('DROP TABLE IF EXISTS deployment_operation_leases');
    await queryRunner.query('DROP TABLE IF EXISTS deployment_admission_windows');
  }
}
