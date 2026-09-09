import { DataSource } from 'typeorm';
import { assertDeploymentTarget } from './target';

const valid = {
  NODE_ENV: 'production',
  DEPLOYMENT_TARGET_ID: 'target-1',
  S3_PENDING_BUCKET: 'pending-preview',
  S3_PUBLISHED_BUCKET: 'published-preview',
  S3_BACKUP_BUCKET: 'backup-preview',
};

const target = {
  target_id: 'target-1',
  environment: 'preview',
  pending_bucket: 'pending-preview',
  published_bucket: 'published-preview',
  backup_bucket: 'backup-preview',
};
const source = (rows: unknown[]) =>
  ({
    query: jest
      .fn()
      .mockResolvedValueOnce([{ name: 'deployment_target' }])
      .mockResolvedValueOnce(rows),
  }) as unknown as DataSource;

describe('assertDeploymentTarget', () => {
  it.each([
    [{ ...valid, DEPLOYMENT_TARGET_ID: 'wrong' }, /identity or environment/],
    [{ ...valid, S3_BACKUP_BUCKET: 'wrong' }, /S3_BACKUP_BUCKET/],
  ])('rejects a mismatched provisioned target', async (env, message) => {
    await expect(
      assertDeploymentTarget(source([target]), 'preview', 'backup', env),
    ).rejects.toThrow(message);
  });

  it('rejects a target from another environment and an unprovisioned profile', async () => {
    await expect(
      assertDeploymentTarget(
        source([{ ...target, environment: 'production' }]),
        'preview',
        'backup',
        valid,
      ),
    ).rejects.toThrow('identity or environment');
    await expect(
      assertDeploymentTarget(source([]), 'preview', 'backup', valid),
    ).rejects.toThrow('identity or environment');
  });

  it('accepts an exact provisioned profile and permits bootstrap only for a missing migration table', async () => {
    await expect(
      assertDeploymentTarget(source([target]), 'preview', 'backup', valid),
    ).resolves.toBeUndefined();
    const missing = {
      query: jest.fn().mockResolvedValue([{ name: null }]),
    } as unknown as DataSource;
    await expect(
      assertDeploymentTarget(missing, 'preview', 'migration', {
        ...valid,
        ALLOW_DEPLOYMENT_BOOTSTRAP: 'true',
      }),
    ).resolves.toBeUndefined();
    await expect(
      assertDeploymentTarget(missing, 'preview', 'backup', valid),
    ).rejects.toThrow('not provisioned');
  });
});
