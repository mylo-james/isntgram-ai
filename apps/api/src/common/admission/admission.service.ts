import {
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';

type UploadReservation = { reservationId: string; expiresAt: Date };

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_LIVE_MEDIA_BYTES = 1024 * 1024 * 1024;

class AdmissionLimitException extends HttpException {
  constructor(response: string | Record<string, unknown>) {
    super(response, HttpStatus.TOO_MANY_REQUESTS);
  }
}

@Injectable()
export class AdmissionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  isDeploymentMode(): boolean {
    return ['preview', 'production'].includes(
      this.config.get<string>('DEPLOYMENT_ENV') ?? '',
    );
  }

  private environment(): string {
    const value = this.config.get<string>('DEPLOYMENT_ENV');
    if (!value || !['preview', 'production'].includes(value)) {
      throw new ServiceUnavailableException(
        'Deployment admission is unavailable',
      );
    }
    return value;
  }

  private positiveInt(
    name: string,
    fallback: number,
    maximum = fallback,
  ): number {
    const value = Number(this.config.get<string>(name) ?? fallback);
    return Number.isInteger(value) && value > 0
      ? Math.min(value, maximum)
      : fallback;
  }

  private windowStart(periodMs: number, now = new Date()): Date {
    return new Date(Math.floor(now.getTime() / periodMs) * periodMs);
  }

  private async incrementWindow(
    scope: string,
    subject: string,
    periodMs: number,
    limit: number,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<void> {
    const now = new Date();
    const start = this.windowStart(periodMs, now);
    const rows = (await manager.query(
      `INSERT INTO deployment_admission_windows
        (environment, scope, subject, window_starts_at, count, updated_at)
       VALUES ($1, $2, $3, $4, 1, NOW())
       ON CONFLICT (environment, scope, subject, window_starts_at)
       DO UPDATE SET count = deployment_admission_windows.count + 1, updated_at = NOW()
       WHERE deployment_admission_windows.count < $5
       RETURNING count`,
      [this.environment(), scope, subject, start, limit],
    )) as Array<{ count: number }>;
    if (rows.length !== 1) {
      const retryAt = new Date(start.getTime() + periodMs).toISOString();
      throw new AdmissionLimitException({
        message: 'Admission limit reached. Try again after the current window.',
        retryAt,
      });
    }
  }

  private async assertCleanupFresh(
    manager: EntityManager = this.dataSource.manager,
  ): Promise<void> {
    const staleAfter = this.positiveInt('CLEANUP_STALE_AFTER_SECONDS', 10_800);
    const rows = (await manager.query(
      `SELECT cleanup_last_succeeded_at
       FROM deployment_maintenance_state WHERE environment = $1`,
      [this.environment()],
    )) as Array<{ cleanup_last_succeeded_at: Date | string | null }>;
    const lastSuccess = rows[0]?.cleanup_last_succeeded_at;
    const lastTime = lastSuccess ? new Date(lastSuccess).getTime() : Number.NaN;
    if (
      !Number.isFinite(lastTime) ||
      Date.now() - lastTime > staleAfter * 1000
    ) {
      throw new ServiceUnavailableException(
        'Temporary creation is paused while cleanup is being recovered.',
      );
    }
  }

  private async acquireLease(
    kind: string,
    subject: string,
    limit: number,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<void> {
    const ttlSeconds = this.positiveInt('ADMISSION_LEASE_SECONDS', 120);
    const environment = this.environment();
    const rows = (await manager.query(
      `WITH removed AS (
         DELETE FROM deployment_operation_leases
         WHERE environment = $1 AND kind = $2 AND expires_at <= NOW()
       ), current AS (
         SELECT count(*)::int AS count FROM deployment_operation_leases
         WHERE environment = $1 AND kind = $2 AND expires_at > NOW()
       )
       INSERT INTO deployment_operation_leases (environment, kind, subject, expires_at)
       SELECT $1, $2, $3, NOW() + ($4 * INTERVAL '1 second') FROM current WHERE count < $5
       RETURNING id`,
      [environment, kind, subject, ttlSeconds, limit],
    )) as Array<{ id: string }>;
    if (rows.length !== 1) {
      throw new AdmissionLimitException(
        'Temporary creation is busy. Try again shortly.',
      );
    }
  }

  private async releaseLease(kind: string, subject: string): Promise<void> {
    await this.dataSource.query(
      'DELETE FROM deployment_operation_leases WHERE environment = $1 AND kind = $2 AND subject = $3',
      [this.environment(), kind, subject],
    );
  }

  async admitDemo(address: string, operationId: string): Promise<void> {
    if (!this.isDeploymentMode()) return;
    try {
      await this.dataSource.transaction(async (manager) => {
        await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
          `isntgram-admission:${this.environment()}`,
        ]);
        await this.assertCleanupFresh(manager);
        await this.incrementWindow(
          'demo-address-hour',
          address,
          HOUR_MS,
          this.positiveInt('DEMO_ADDRESS_HOURLY_LIMIT', 5),
          manager,
        );
        await this.incrementWindow(
          'demo-global-day',
          'all',
          DAY_MS,
          this.positiveInt('DEMO_GLOBAL_DAILY_LIMIT', 30),
          manager,
        );
        const database = (await manager.query(
          'SELECT pg_database_size(current_database())::bigint AS bytes',
        )) as Array<{ bytes: string | number }>;
        if (Number(database[0]?.bytes ?? 0) >= 350 * 1024 * 1024) {
          throw new AdmissionLimitException(
            'Temporary demo capacity is full. Try again later.',
          );
        }
        const active = (await manager.query(
          `SELECT count(*)::int AS count FROM users
         WHERE "isDemoUser" = true AND "isDemoSeed" = false AND "demoExpiresAt" > NOW()`,
        )) as Array<{ count: number }>;
        await manager.query(
          `DELETE FROM deployment_operation_leases WHERE environment = $1 AND kind = 'demo-create' AND expires_at <= NOW()`,
          [this.environment()],
        );
        const inflight = (await manager.query(
          `SELECT count(*)::int AS count FROM deployment_operation_leases WHERE environment = $1 AND kind = 'demo-create' AND expires_at > NOW()`,
          [this.environment()],
        )) as Array<{ count: number }>;
        if (
          (active[0]?.count ?? 0) + (inflight[0]?.count ?? 0) >=
          this.positiveInt('DEMO_ACTIVE_SESSION_LIMIT', 60)
        ) {
          throw new AdmissionLimitException(
            'Temporary demo capacity is full. Try again later.',
          );
        }
        await this.acquireLease(
          'demo-create',
          operationId,
          this.positiveInt('DEMO_CREATION_CONCURRENCY_LIMIT', 2),
          manager,
        );
      });
    } catch (error) {
      if (
        error instanceof AdmissionLimitException ||
        error instanceof ServiceUnavailableException
      )
        throw error;
      throw new ServiceUnavailableException(
        'Temporary creation is unavailable. Try again shortly.',
      );
    }
  }

  async admitApiRequest(subject: {
    userId?: string;
    address?: string;
  }): Promise<void> {
    if (!this.isDeploymentMode()) return;
    try {
      if (subject.userId) {
        await this.incrementWindow(
          'api-user-minute',
          subject.userId,
          60_000,
          this.positiveInt('AUTHENTICATED_API_PER_MINUTE_LIMIT', 60),
        );
      } else {
        await this.incrementWindow(
          'api-address-minute',
          subject.address || 'unknown',
          60_000,
          this.positiveInt('UNAUTHENTICATED_API_PER_MINUTE_LIMIT', 120),
        );
      }
    } catch (error) {
      if (
        error instanceof AdmissionLimitException ||
        error instanceof ServiceUnavailableException
      )
        throw error;
      throw new ServiceUnavailableException(
        'Request admission is unavailable. Try again shortly.',
      );
    }
  }

  async completeDemo(operationId: string): Promise<void> {
    if (!this.isDeploymentMode()) return;
    try {
      await this.releaseLease('demo-create', operationId);
    } catch {
      // Leases have a short expiry; never turn a completed session into a failed response.
    }
  }

  async reserveUpload(input: {
    userId: string;
    uploadId: string;
    bytes: number;
  }): Promise<UploadReservation> {
    if (!this.isDeploymentMode())
      return {
        reservationId: input.uploadId,
        expiresAt: new Date(Date.now() + 10 * 60_000),
      };
    if (
      !Number.isInteger(input.bytes) ||
      input.bytes <= 0 ||
      input.bytes > MAX_UPLOAD_BYTES
    ) {
      throw new AdmissionLimitException(
        'Upload size is outside the accepted limit.',
      );
    }
    // Publication briefly retains the untrusted pending original while writing
    // the validated published derivative. The derivative may be larger than its
    // source, so reserve the original plus the full accepted published ceiling.
    const reservationBytes = input.bytes + MAX_UPLOAD_BYTES;
    try {
      return await this.dataSource.transaction(async (manager) => {
        await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
          `isntgram-admission:${this.environment()}`,
        ]);
        await this.assertCleanupFresh(manager);
        await this.incrementWindow(
          'upload-user-day',
          input.userId,
          DAY_MS,
          this.positiveInt('UPLOAD_USER_DAILY_LIMIT', 10),
          manager,
        );
        await this.incrementWindow(
          'upload-global-day',
          'all',
          DAY_MS,
          this.positiveInt('UPLOAD_GLOBAL_DAILY_LIMIT', 20),
          manager,
        );
        const environment = this.environment();
        const leaseSeconds = this.positiveInt(
          'UPLOAD_RESERVATION_SECONDS',
          600,
        );
        const existing = (await manager.query(
          `SELECT bytes, state, expires_at FROM deployment_upload_reservations
         WHERE environment = $1 AND upload_id = $2 AND user_id = $3`,
          [environment, input.uploadId, input.userId],
        )) as Array<{
          bytes: string | number;
          state: string;
          expires_at: Date | string;
        }>;
        if (
          existing.length === 1 &&
          Number(existing[0].bytes) === reservationBytes &&
          existing[0].state === 'reserved'
        ) {
          return {
            reservationId: input.uploadId,
            expiresAt: new Date(existing[0].expires_at),
          };
        }
        if (existing.length > 0)
          throw new AdmissionLimitException(
            'Upload reservation cannot be reused.',
          );
        const live = (await manager.query(
          `SELECT COALESCE(SUM(bytes), 0)::bigint AS bytes FROM deployment_upload_reservations
         WHERE environment = $1 AND state IN ('reserved', 'complete')`,
          [environment],
        )) as Array<{ bytes: string | number }>;
        if (
          Number(live[0]?.bytes ?? 0) + reservationBytes >
          this.positiveInt(
            'LIVE_MEDIA_MAX_BYTES',
            MAX_LIVE_MEDIA_BYTES,
            MAX_LIVE_MEDIA_BYTES,
          )
        ) {
          throw new AdmissionLimitException(
            'Temporary upload capacity is full. Try again later.',
          );
        }
        const database = (await manager.query(
          'SELECT pg_database_size(current_database())::bigint AS bytes',
        )) as Array<{ bytes: string | number }>;
        if (Number(database[0]?.bytes ?? 0) >= 350 * 1024 * 1024) {
          throw new AdmissionLimitException(
            'Temporary upload capacity is full. Try again later.',
          );
        }
        const rows = (await manager.query(
          `INSERT INTO deployment_upload_reservations
          (environment, upload_id, user_id, bytes, state, expires_at)
         VALUES ($1, $2, $3, $4, 'reserved', NOW() + ($5 * INTERVAL '1 second'))
         RETURNING expires_at`,
          [
            environment,
            input.uploadId,
            input.userId,
            reservationBytes,
            leaseSeconds,
          ],
        )) as Array<{ expires_at: Date | string }>;
        return {
          reservationId: input.uploadId,
          expiresAt: new Date(rows[0].expires_at),
        };
      });
    } catch (error) {
      if (
        error instanceof AdmissionLimitException ||
        error instanceof ServiceUnavailableException
      )
        throw error;
      throw new ServiceUnavailableException(
        'Temporary upload admission is unavailable. Try again shortly.',
      );
    }
  }

  async completeUpload(input: {
    userId: string;
    uploadId: string;
  }): Promise<void> {
    if (!this.isDeploymentMode()) return;
    await this.dataSource.query(
      `UPDATE deployment_upload_reservations SET state = 'complete', updated_at = NOW()
       WHERE environment = $1 AND upload_id = $2 AND user_id = $3 AND state = 'reserved'`,
      [this.environment(), input.uploadId, input.userId],
    );
  }

  async releaseUpload(input: {
    userId: string;
    uploadId: string;
  }): Promise<void> {
    if (!this.isDeploymentMode()) return;
    await this.dataSource.query(
      `UPDATE deployment_upload_reservations SET state = 'released', updated_at = NOW()
       WHERE environment = $1 AND upload_id = $2 AND user_id = $3 AND state = 'reserved'`,
      [this.environment(), input.uploadId, input.userId],
    );
  }
}
