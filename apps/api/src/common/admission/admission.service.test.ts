import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AdmissionService } from './admission.service';

const previewConfig = (values: Record<string, string> = {}) =>
  ({
    get: (key: string) => ({ DEPLOYMENT_ENV: 'preview', ...values })[key],
  }) as ConfigService;

function capacitySource(bytes: number): DataSource {
  const query = jest.fn(async (statement: string) => {
    if (statement.includes('cleanup_last_succeeded_at')) {
      return [{ cleanup_last_succeeded_at: new Date() }];
    }
    if (statement.includes('deployment_admission_windows'))
      return [{ count: 1 }];
    if (statement.includes('pg_database_size')) return [{ bytes }];
    return [];
  });
  return {
    query,
    transaction: async (
      work: (manager: { query: typeof query }) => Promise<unknown>,
    ) => work({ query }),
  } as unknown as DataSource;
}

describe('AdmissionService capacity safeguards', () => {
  it('rejects demo creation when PostgreSQL reports the approved database capacity', async () => {
    const service = new AdmissionService(
      capacitySource(350 * 1024 * 1024),
      previewConfig(),
    );

    await expect(
      service.admitDemo('203.0.113.20', 'operation-1'),
    ).rejects.toMatchObject({
      status: 429,
    });
  });

  it('rejects an upload before it reserves bytes when PostgreSQL reports the approved database capacity', async () => {
    const service = new AdmissionService(
      capacitySource(350 * 1024 * 1024),
      previewConfig(),
    );

    await expect(
      service.reserveUpload({
        userId: 'user-1',
        uploadId: 'upload-1',
        bytes: 1024,
      }),
    ).rejects.toMatchObject({ status: 429 });
  });

  it('returns a deterministic local reservation without querying a store outside deployment mode', async () => {
    const dataSource = { query: jest.fn() } as unknown as DataSource;
    const service = new AdmissionService(dataSource, {
      get: () => 'development',
    } as unknown as ConfigService);

    await expect(
      service.reserveUpload({
        userId: 'user-1',
        uploadId: 'upload-1',
        bytes: 1024,
      }),
    ).resolves.toMatchObject({ reservationId: 'upload-1' });
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('contains store outages and best-effort lease release without converting them to accepted work', async () => {
    const unavailable = {
      query: jest.fn().mockRejectedValue(new Error('database offline')),
      transaction: jest.fn().mockRejectedValue(new Error('database offline')),
    } as unknown as DataSource;
    const service = new AdmissionService(unavailable, previewConfig());

    await expect(
      service.reserveUpload({
        userId: 'user-1',
        uploadId: 'upload-1',
        bytes: 1024,
      }),
    ).rejects.toMatchObject({ status: 503 });
    await expect(service.completeDemo('operation-1')).resolves.toBeUndefined();
  });

  it('rejects malformed uploads and maps failed demo admission to a retryable unavailable response', async () => {
    const unavailable = {
      transaction: jest.fn().mockRejectedValue(new Error('database offline')),
    } as unknown as DataSource;
    const service = new AdmissionService(unavailable, previewConfig());

    await expect(
      service.reserveUpload({
        userId: 'user-1',
        uploadId: 'upload-1',
        bytes: 0,
      }),
    ).rejects.toMatchObject({ status: 429 });
    await expect(
      service.admitDemo('203.0.113.20', 'operation-1'),
    ).rejects.toMatchObject({
      status: 503,
    });
  });

  it('uses the authenticated identity counter when an identity is present', async () => {
    const query = jest.fn().mockResolvedValue([{ count: 1 }]);
    const service = new AdmissionService(
      { manager: { query } } as unknown as DataSource,
      previewConfig(),
    );

    await expect(
      service.admitApiRequest({ userId: 'user-1' }),
    ).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('deployment_admission_windows'),
      expect.arrayContaining([
        'api-user-minute',
        'user-1',
        expect.any(Date),
        60,
      ]),
    );
  });

  it('fails closed when cleanup has never recorded a successful completion', async () => {
    const query = jest.fn(async (statement: string) => {
      if (statement.includes('cleanup_last_succeeded_at')) return [];
      return [];
    });
    const service = new AdmissionService(
      {
        transaction: async (
          work: (manager: { query: typeof query }) => Promise<unknown>,
        ) => work({ query }),
      } as unknown as DataSource,
      previewConfig(),
    );

    await expect(
      service.reserveUpload({
        userId: 'user-1',
        uploadId: 'upload-1',
        bytes: 1024,
      }),
    ).rejects.toMatchObject({ status: 503 });
  });

  it('rejects demo admission once active sessions consume the approved capacity', async () => {
    const query = jest.fn(async (statement: string) => {
      if (statement.includes('cleanup_last_succeeded_at')) {
        return [{ cleanup_last_succeeded_at: new Date() }];
      }
      if (statement.includes('deployment_admission_windows'))
        return [{ count: 1 }];
      if (statement.includes('pg_database_size')) return [{ bytes: 0 }];
      if (statement.includes('FROM users')) return [{ count: 60 }];
      if (statement.includes('deployment_operation_leases')) return [];
      return [];
    });
    const service = new AdmissionService(
      {
        transaction: async (
          work: (manager: { query: typeof query }) => Promise<unknown>,
        ) => work({ query }),
      } as unknown as DataSource,
      previewConfig(),
    );

    await expect(
      service.admitDemo('203.0.113.20', 'operation-1'),
    ).rejects.toMatchObject({
      status: 429,
    });
  });
});
