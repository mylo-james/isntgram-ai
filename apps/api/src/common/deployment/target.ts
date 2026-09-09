import { DataSource } from 'typeorm';

/** Bind maintenance to a provisioned database identity and its exact buckets. */
export async function assertDeploymentTarget(
  dataSource: DataSource,
  environment: string,
  operation: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  if (
    !['preview', 'production'].includes(environment) &&
    env.NODE_ENV !== 'production'
  )
    return;
  const present = await dataSource.query(
    "SELECT to_regclass('public.deployment_target') AS name",
  );
  if (!present[0]?.name) {
    if (operation === 'migration' && env.ALLOW_DEPLOYMENT_BOOTSTRAP === 'true')
      return;
    throw new Error(
      'Deployment target is not provisioned; maintenance refused',
    );
  }
  const rows = await dataSource.query('SELECT * FROM deployment_target');
  const target = rows[0];
  if (
    rows.length !== 1 ||
    !env.DEPLOYMENT_TARGET_ID ||
    target.target_id !== env.DEPLOYMENT_TARGET_ID ||
    target.environment !== environment
  ) {
    throw new Error('Deployment database identity or environment differs');
  }
  for (const [name, column] of [
    ['S3_PENDING_BUCKET', 'pending_bucket'],
    ['S3_PUBLISHED_BUCKET', 'published_bucket'],
    ['S3_BACKUP_BUCKET', 'backup_bucket'],
  ] as const) {
    if (env[name] && env[name] !== target[column])
      throw new Error(`Deployment target ${name} differs`);
  }
  if (
    ['cleanup', 'api'].includes(operation) &&
    (!env.S3_PENDING_BUCKET || !env.S3_PUBLISHED_BUCKET)
  )
    throw new Error('API and cleanup require both target buckets');
  if (
    operation === 'backup' &&
    (!env.S3_BACKUP_BUCKET || !env.S3_PUBLISHED_BUCKET)
  )
    throw new Error('Backup requires both target buckets');
}
