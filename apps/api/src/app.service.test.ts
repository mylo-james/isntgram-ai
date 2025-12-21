import { AppService } from './app.service';
import { DataSource } from 'typeorm';

describe('AppService', () => {
  const createDataSource = (queryImpl: () => Promise<unknown>): DataSource =>
    ({ query: jest.fn(queryImpl) }) as unknown as DataSource;

  describe('getHello', () => {
    it('should return "Hello World!"', () => {
      const service = new AppService();
      const result = service.getHello();
      expect(result).toBe('Isntgram API');
      expect(typeof result).toBe('string');
    });
  });

  describe('getReadiness', () => {
    it('returns ok + skipped when database is not configured', async () => {
      const service = new AppService();
      await expect(service.getReadiness()).resolves.toEqual({
        status: 'ok',
        database: 'skipped',
      });
    });

    it('returns ok + connected when database responds', async () => {
      const dataSource = createDataSource(async () => [1]);
      const service = new AppService(dataSource);

      await expect(service.getReadiness()).resolves.toEqual({
        status: 'ok',
        database: 'connected',
      });
      expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('returns degraded + disconnected when database query fails', async () => {
      const dataSource = createDataSource(async () => {
        throw new Error('boom');
      });
      const service = new AppService(dataSource);

      await expect(service.getReadiness()).resolves.toEqual({
        status: 'degraded',
        database: 'disconnected',
      });
      expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
    });
  });
});
