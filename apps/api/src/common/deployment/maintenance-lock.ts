import { ConflictException } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { assertDeploymentTarget } from './target';

const LOCK_NAMESPACE = 'isntgram-maintenance-v1';

/**
 * Serializes database-affecting maintenance operations on one dedicated
 * connection. An advisory lock is intentionally held only while the caller is
 * doing its bounded operation; never retain it across a queued HTTP request.
 */
export async function withMaintenanceLock<T>(
  dataSource: DataSource,
  environment: string,
  operation: string,
  work: (runner: QueryRunner) => Promise<T>,
): Promise<T> {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(environment))
    throw new Error('Invalid maintenance environment');
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(operation))
    throw new Error('Invalid maintenance operation');

  await assertDeploymentTarget(dataSource, environment, operation);
  const runner = dataSource.createQueryRunner();
  const key = `${LOCK_NAMESPACE}:${environment}`;
  let locked = false;
  let connected = false;
  let unlockFailure: unknown;
  try {
    await runner.connect();
    connected = true;
    const rows = (await runner.query(
      'SELECT pg_try_advisory_lock(hashtext($1)) AS locked',
      [key],
    )) as Array<{ locked: boolean }>;
    locked = rows[0]?.locked === true;
    if (!locked)
      throw new ConflictException(
        `${operation} is already running for this environment`,
      );
    return await work(runner);
  } finally {
    if (locked) {
      try {
        await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [key]);
      } catch (error) {
        unlockFailure = error;
      }
    }
    if (connected) await runner.release();
    // A failed unlock has an unknown session outcome. Do not let a caller mark
    // its maintenance work successful when that session may still hold a lock.
    if (unlockFailure)
      throw new Error(
        `Maintenance lock release outcome is unknown: ${unlockFailure instanceof Error ? unlockFailure.message : 'unlock failed'}`,
      );
  }
}
