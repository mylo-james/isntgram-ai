import { withMaintenanceLock } from './maintenance-lock';
import { DataSource } from 'typeorm';

describe('withMaintenanceLock', () => {
  const runner = () => ({
    connect: jest.fn(),
    query: jest.fn(),
    release: jest.fn(),
  });

  it('releases an acquired advisory lock when the protected operation throws', async () => {
    const connection = runner();
    connection.query
      .mockResolvedValueOnce([{ locked: true }])
      .mockResolvedValueOnce([]);
    const dataSource = {
      createQueryRunner: jest.fn(() => connection),
    } as unknown as DataSource;

    await expect(
      withMaintenanceLock(dataSource, 'storagetest', 'cleanup', async () => {
        throw new Error('cleanup failed');
      }),
    ).rejects.toThrow('cleanup failed');
    expect(connection.query).toHaveBeenLastCalledWith(
      'SELECT pg_advisory_unlock(hashtext($1))',
      ['isntgram-maintenance-v1:storagetest'],
    );
    expect(connection.release).toHaveBeenCalledTimes(1);
  });

  it('releases the dedicated connection after lock contention without running work', async () => {
    const connection = runner();
    connection.query.mockResolvedValueOnce([{ locked: false }]);
    const dataSource = {
      createQueryRunner: jest.fn(() => connection),
    } as unknown as DataSource;
    const work = jest.fn();

    await expect(
      withMaintenanceLock(dataSource, 'storagetest', 'backup', work),
    ).rejects.toMatchObject({ status: 409 });
    expect(work).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid lock identifiers before opening a database connection', async () => {
    const dataSource = {
      createQueryRunner: jest.fn(),
    } as unknown as DataSource;

    await expect(
      withMaintenanceLock(
        dataSource,
        'preview/unsafe',
        'cleanup',
        async () => undefined,
      ),
    ).rejects.toThrow('Invalid maintenance environment');
    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
  });
});
