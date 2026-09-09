import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { fork } from 'child_process';
import { join } from 'path';
import { AdmissionService } from '../src/common/admission/admission.service';

const url = process.env.ISNTGRAM_ADMISSION_TEST_DATABASE_URL;
const describePostgres = url ? describe : describe.skip;

describePostgres(
  'PostgreSQL admission across independent service instances',
  () => {
    let first: DataSource;
    let second: DataSource;

    beforeAll(async () => {
      first = new DataSource({ type: 'postgres', url });
      second = new DataSource({ type: 'postgres', url });
      await Promise.all([first.initialize(), second.initialize()]);
    });
    beforeEach(async () => {
      await first.query(
        'TRUNCATE deployment_admission_windows, deployment_operation_leases, deployment_upload_reservations',
      );
      await first.query(`INSERT INTO deployment_maintenance_state (environment, cleanup_last_succeeded_at)
      VALUES ('preview', NOW()) ON CONFLICT (environment) DO UPDATE SET cleanup_last_succeeded_at = NOW()`);
    });
    afterAll(async () => Promise.all([first.destroy(), second.destroy()]));

    const worker = (input: {
      action?: 'reserve-upload' | 'admit-demo';
      config?: Record<string, string>;
      userId?: string;
      uploadId?: string;
      bytes?: number;
      address?: string;
      operationId?: string;
    }) =>
      new Promise<{ ok: boolean; status?: number }>((resolve, reject) => {
        const child = fork(join(__dirname, 'admission-worker.cjs'), [], {
          cwd: join(__dirname, '..'),
          stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
        });
        child.once('message', (result) =>
          resolve(result as { ok: boolean; status?: number }),
        );
        child.once('error', reject);
        child.send({ url, ...input });
      });

    it('admits only one simultaneous global upload when the configured cap is one', async () => {
      const config = {
        get: (key: string) =>
          ({ DEPLOYMENT_ENV: 'preview', UPLOAD_GLOBAL_DAILY_LIMIT: '1' })[key],
      } as ConfigService;
      const one = new AdmissionService(first, config);
      const two = new AdmissionService(second, config);
      const [a, b] = await Promise.allSettled([
        one.reserveUpload({
          userId: randomUUID(),
          uploadId: randomUUID(),
          bytes: 1024,
        }),
        two.reserveUpload({
          userId: randomUUID(),
          uploadId: randomUUID(),
          bytes: 1024,
        }),
      ]);
      expect(
        [a, b].filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        await first.query(`SELECT count FROM deployment_admission_windows
      WHERE environment = 'preview' AND scope = 'upload-global-day' AND subject = 'all'`),
      ).toEqual([{ count: 1 }]);
    });

    it('keeps the cap across two separate Node admission workers', async () => {
      const result = await Promise.all([
        worker({
          config: { UPLOAD_GLOBAL_DAILY_LIMIT: '1' },
          userId: randomUUID(),
          uploadId: randomUUID(),
        }),
        worker({
          config: { UPLOAD_GLOBAL_DAILY_LIMIT: '1' },
          userId: randomUUID(),
          uploadId: randomUUID(),
        }),
      ]);
      expect(result.filter((item) => item.ok)).toHaveLength(1);
      expect(result.filter((item) => item.status === 429)).toHaveLength(1);
    });

    it('keeps the live media byte cap across separate Node processes', async () => {
      const result = await Promise.all([
        worker({
          config: { LIVE_MEDIA_MAX_BYTES: '5243500' },
          userId: randomUUID(),
          uploadId: randomUUID(),
          bytes: 400,
        }),
        worker({
          config: { LIVE_MEDIA_MAX_BYTES: '5243500' },
          userId: randomUUID(),
          uploadId: randomUUID(),
          bytes: 400,
        }),
      ]);
      expect(result.filter((item) => item.ok)).toHaveLength(1);
      expect(result.filter((item) => item.status === 429)).toHaveLength(1);
    });

    it('keeps demo creation leases below the configured concurrency cap across separate Node processes', async () => {
      const result = await Promise.all([
        worker({
          action: 'admit-demo',
          config: {
            DEMO_CREATION_CONCURRENCY_LIMIT: '1',
            DEMO_ACTIVE_SESSION_LIMIT: '60',
          },
          address: '203.0.113.101',
          operationId: randomUUID(),
        }),
        worker({
          action: 'admit-demo',
          config: {
            DEMO_CREATION_CONCURRENCY_LIMIT: '1',
            DEMO_ACTIVE_SESSION_LIMIT: '60',
          },
          address: '203.0.113.102',
          operationId: randomUUID(),
        }),
      ]);
      expect(result.filter((item) => item.ok)).toHaveLength(1);
      expect(result.filter((item) => item.status === 429)).toHaveLength(1);
    });

    it('counts in-flight demo leases against the active session cap across separate Node processes', async () => {
      const result = await Promise.all([
        worker({
          action: 'admit-demo',
          config: {
            DEMO_CREATION_CONCURRENCY_LIMIT: '2',
            DEMO_ACTIVE_SESSION_LIMIT: '1',
          },
          address: '203.0.113.103',
          operationId: randomUUID(),
        }),
        worker({
          action: 'admit-demo',
          config: {
            DEMO_CREATION_CONCURRENCY_LIMIT: '2',
            DEMO_ACTIVE_SESSION_LIMIT: '1',
          },
          address: '203.0.113.104',
          operationId: randomUUID(),
        }),
      ]);
      expect(result.filter((item) => item.ok)).toHaveLength(1);
      expect(result.filter((item) => item.status === 429)).toHaveLength(1);
    });

    it('retains a window across a restarted admission service and expires old windows', async () => {
      const config = {
        get: (key: string) =>
          ({
            DEPLOYMENT_ENV: 'preview',
            UNAUTHENTICATED_API_PER_MINUTE_LIMIT: '1',
          })[key],
      } as ConfigService;
      await new AdmissionService(first, config).admitApiRequest({
        address: '198.51.100.3',
      });

      await expect(
        new AdmissionService(second, config).admitApiRequest({
          address: '198.51.100.3',
        }),
      ).rejects.toMatchObject({ status: 429 });
      await first.query(`UPDATE deployment_admission_windows SET window_starts_at = window_starts_at - INTERVAL '2 minutes'
      WHERE scope = 'api-address-minute'`);
      await expect(
        new AdmissionService(second, config).admitApiRequest({
          address: '198.51.100.3',
        }),
      ).resolves.toBeUndefined();
    });

    it('does not permit a configuration override to raise the approved unauthenticated limit', async () => {
      const config = {
        get: (key: string) =>
          ({
            DEPLOYMENT_ENV: 'preview',
            UNAUTHENTICATED_API_PER_MINUTE_LIMIT: '999',
          })[key],
      } as ConfigService;
      const service = new AdmissionService(first, config);
      for (let index = 0; index < 120; index += 1) {
        await expect(
          service.admitApiRequest({ address: '198.51.100.12' }),
        ).resolves.toBeUndefined();
      }
      await expect(
        service.admitApiRequest({ address: '198.51.100.12' }),
      ).rejects.toMatchObject({ status: 429 });
    });

    it('fails closed while cleanup is stale and recovers after a fresh cleanup record', async () => {
      const config = {
        get: (key: string) => ({ DEPLOYMENT_ENV: 'preview' })[key],
      } as ConfigService;
      await first.query(
        `UPDATE deployment_maintenance_state
       SET cleanup_last_succeeded_at = NOW() - INTERVAL '3 hours 1 second'
       WHERE environment = 'preview'`,
      );
      const service = new AdmissionService(first, config);
      await expect(
        service.reserveUpload({
          userId: randomUUID(),
          uploadId: randomUUID(),
          bytes: 1024,
        }),
      ).rejects.toMatchObject({ status: 503 });
      await first.query(
        `UPDATE deployment_maintenance_state
       SET cleanup_last_succeeded_at = NOW() WHERE environment = 'preview'`,
      );
      await expect(
        service.reserveUpload({
          userId: randomUUID(),
          uploadId: randomUUID(),
          bytes: 1024,
        }),
      ).resolves.toMatchObject({ reservationId: expect.any(String) });
    });

    it('keeps a matching upload reservation idempotent and persists completion or release', async () => {
      const config = {
        get: (key: string) => ({ DEPLOYMENT_ENV: 'preview' })[key],
      } as ConfigService;
      const service = new AdmissionService(first, config);
      const userId = randomUUID();
      const uploadId = randomUUID();
      const firstReservation = await service.reserveUpload({
        userId,
        uploadId,
        bytes: 1024,
      });
      const repeated = await service.reserveUpload({
        userId,
        uploadId,
        bytes: 1024,
      });
      expect(repeated.expiresAt).toEqual(firstReservation.expiresAt);
      expect(
        await first.query(
          `SELECT state, bytes FROM deployment_upload_reservations
         WHERE environment = 'preview' AND upload_id = $1 AND user_id = $2`,
          [uploadId, userId],
        ),
      ).toEqual([{ state: 'reserved', bytes: '5243904' }]);
      await service.completeUpload({ userId, uploadId });
      await service.releaseUpload({ userId, uploadId });
      expect(
        await first.query(
          `SELECT state FROM deployment_upload_reservations
         WHERE environment = 'preview' AND upload_id = $1 AND user_id = $2`,
          [uploadId, userId],
        ),
      ).toEqual([{ state: 'complete' }]);
    });

    it('rejects a mismatched reservation and a direct live-byte overage', async () => {
      const config = {
        get: (key: string) =>
          ({ DEPLOYMENT_ENV: 'preview', LIVE_MEDIA_MAX_BYTES: '5243500' })[key],
      } as ConfigService;
      const service = new AdmissionService(first, config);
      const userId = randomUUID();
      const uploadId = randomUUID();
      await service.reserveUpload({ userId, uploadId, bytes: 400 });
      await expect(
        service.reserveUpload({ userId, uploadId, bytes: 350 }),
      ).rejects.toMatchObject({ status: 429 });
      await expect(
        service.reserveUpload({
          userId: randomUUID(),
          uploadId: randomUUID(),
          bytes: 300,
        }),
      ).rejects.toMatchObject({ status: 429 });
    });

    it('reconciles an expired demo creation lease', async () => {
      const config = {
        get: (key: string) =>
          ({
            DEPLOYMENT_ENV: 'preview',
            DEMO_CREATION_CONCURRENCY_LIMIT: '1',
            ADMISSION_LEASE_SECONDS: '1',
          })[key],
      } as ConfigService;
      const service = new AdmissionService(first, config);
      await service.admitDemo('203.0.113.8', 'first');
      await expect(
        new AdmissionService(second, config).admitDemo('203.0.113.9', 'second'),
      ).rejects.toMatchObject({ status: 429 });
      await first.query(
        `UPDATE deployment_operation_leases SET expires_at = NOW() - INTERVAL '1 second'`,
      );
      await expect(
        new AdmissionService(second, config).admitDemo('203.0.113.9', 'second'),
      ).resolves.toBeUndefined();
    });

    it('fails closed when the counter store cannot be queried', async () => {
      const unavailable = {
        query: jest.fn().mockRejectedValue(new Error('database unavailable')),
      } as unknown as DataSource;
      const config = {
        get: (key: string) => ({ DEPLOYMENT_ENV: 'preview' })[key],
      } as ConfigService;
      await expect(
        new AdmissionService(unavailable, config).admitApiRequest({
          address: '203.0.113.10',
        }),
      ).rejects.toMatchObject({ status: 503 });
    });
  },
);
