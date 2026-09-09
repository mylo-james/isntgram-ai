import dataSource from '../ormconfig';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { withMaintenanceLock } from '../src/common/deployment/maintenance-lock';

type Intent = {
  id: string;
  bucket_kind: 'pending' | 'published';
  object_key: string;
};

function configuredBucket(kind: 'pending' | 'published'): string {
  return kind === 'pending'
    ? process.env.S3_PENDING_BUCKET || process.env.S3_BUCKET || ''
    : process.env.S3_PUBLISHED_BUCKET || process.env.S3_BUCKET || '';
}

function storageClient() {
  const endpoint = process.env.S3_ENDPOINT;
  return new S3Client({
    region: process.env.S3_REGION || 'auto',
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },
  });
}

async function main() {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  if (
    nodeEnv === 'production' &&
    process.env.ALLOW_PROD_MAINTENANCE !== 'true'
  ) {
    throw new Error(
      'Refusing to run in production without ALLOW_PROD_MAINTENANCE=true',
    );
  }

  const environment = process.env.DEPLOYMENT_ENV ?? nodeEnv;
  if (nodeEnv === 'production' && !process.env.DATABASE_DIRECT_URL)
    throw new Error(
      'DATABASE_DIRECT_URL must be set for production maintenance',
    );
  await dataSource.initialize();
  try {
    await withMaintenanceLock(
      dataSource,
      environment,
      'cleanup',
      async (queryRunner) => {
        await queryRunner.startTransaction();
        try {
          const expired = (await queryRunner.query(
            `
        SELECT "id"
        FROM "users"
        WHERE "isDemoUser" = true
          AND "isDemoSeed" = false
          AND "demoExpiresAt" IS NOT NULL
          AND "demoExpiresAt" < NOW();
      `,
          )) as Array<{ id: string }>;

          const expiredIds = expired.map((row) => row.id);
          // Record deletion before cascading database removal. Each intent is
          // environment-scoped and idempotent, so a storage outage resumes safely.
          if (expiredIds.length > 0) {
            const media = (await queryRunner.query(
              `SELECT id, "pendingKey", "publishedKey" FROM "media_uploads" WHERE "ownerId" = ANY($1::uuid[])`,
              [expiredIds],
            )) as Array<{
              id: string;
              pendingKey: string;
              publishedKey: string | null;
            }>;
            for (const row of media) {
              await queryRunner.query(
                `INSERT INTO media_deletion_intents (environment, upload_id, bucket_kind, object_key, reason)
           VALUES ($1, $2, 'pending', $3, 'expired_demo')
           ON CONFLICT (environment, bucket_kind, object_key) DO NOTHING`,
                [environment, row.id, row.pendingKey],
              );
              if (row.publishedKey)
                await queryRunner.query(
                  `INSERT INTO media_deletion_intents (environment, upload_id, bucket_kind, object_key, reason)
           VALUES ($1, $2, 'published', $3, 'expired_demo')
           ON CONFLICT (environment, bucket_kind, object_key) DO NOTHING`,
                  [environment, row.id, row.publishedKey],
                );
            }
          }
          // A presigned URL can be abandoned without a completed demo expiry. Reclaim
          // only unbound pending intents owned by disposable visitors after one hour;
          // seeds and any retained-user mode are deliberately out of scope.
          const stalePending = (await queryRunner.query(
            `SELECT m.id, m."pendingKey" FROM "media_uploads" m
       JOIN "users" u ON u.id = m."ownerId"
       WHERE u."isDemoUser" = true AND u."isDemoSeed" = false
         AND m."createdAt" < NOW() - INTERVAL '1 hour'`,
          )) as Array<{ id: string; pendingKey: string }>;
          for (const row of stalePending) {
            await queryRunner.query(
              `INSERT INTO media_deletion_intents (environment, upload_id, bucket_kind, object_key, reason)
         VALUES ($1, $2, 'pending', $3, 'stale_pending')
         ON CONFLICT (environment, bucket_kind, object_key) DO NOTHING`,
              [environment, row.id, row.pendingKey],
            );
          }
          if (stalePending.length > 0) {
            // Bound uploads retain their published binding; cleanup deletes only the
            // raw pending object. Unbound uploads may be removed after its intent is
            // durable, so a retry still owns the storage work.
            await queryRunner.query(
              `DELETE FROM "media_uploads" WHERE "id" = ANY($1::uuid[])
         AND "postId" IS NULL AND "profilePictureUserId" IS NULL`,
              [stalePending.map((row) => row.id)],
            );
          }
          if (expiredIds.length === 0) {
            await queryRunner.commitTransaction();
            // eslint-disable-next-line no-console
            console.log('✅ No expired demo users to delete');
          }

          if (expiredIds.length > 0) {
            await queryRunner.query(
              `DELETE FROM "media_uploads" WHERE "ownerId" = ANY($1::uuid[])`,
              [expiredIds],
            );
            await queryRunner.query(
              `
        DELETE FROM "users"
        WHERE "id" = ANY($1::uuid[]);
      `,
              [expiredIds],
            );

            // Demo isolation guarantees demo users only follow demo users, so counters can be safely reconciled for demo namespace only.
            await queryRunner.query(`
      UPDATE "users" u
      SET "postsCount" = (
        SELECT COUNT(*)::int
        FROM "posts" p
        WHERE p."authorId" = u."id"
      )
      WHERE u."isDemoUser" = true;
    `);

            await queryRunner.query(`
      UPDATE "users" u
      SET "followingCount" = (
        SELECT COUNT(*)::int
        FROM "follows" f
        WHERE f."followerId" = u."id"
      )
      WHERE u."isDemoUser" = true;
    `);

            await queryRunner.query(`
      UPDATE "users" u
      SET "followerCount" = (
        SELECT COUNT(*)::int
        FROM "follows" f
        WHERE f."followingId" = u."id"
      )
      WHERE u."isDemoUser" = true;
    `);

            await queryRunner.query(`
      UPDATE "posts" p
      SET "likeCount" = (
        SELECT COUNT(*)::int
        FROM "likes" l
        WHERE l."postId" = p."id"
      ),
      "commentCount" = (
        SELECT COUNT(*)::int
        FROM "comments" c
        WHERE c."postId" = p."id"
      )
      WHERE p."authorId" IN (
        SELECT u."id"
        FROM "users" u
        WHERE u."isDemoUser" = true
      );
    `);

            await queryRunner.commitTransaction();
            // eslint-disable-next-line no-console
            console.log(
              `✅ Deleted ${expiredIds.length} expired demo user(s) and reconciled demo counters`,
            );
          }
        } catch (error) {
          await queryRunner.rollbackTransaction();
          throw error;
        }
        // Keep the advisory connection for external deletion and success marking.
        // A failed delete leaves its durable intent pending for the next run.
        const intents = (await queryRunner.query(
          `SELECT id, bucket_kind, object_key FROM media_deletion_intents
       WHERE environment = $1 AND completed_at IS NULL ORDER BY created_at LIMIT 500`,
          [environment],
        )) as Intent[];
        const s3 = storageClient();
        try {
          for (const intent of intents) {
            try {
              const bucket = configuredBucket(intent.bucket_kind);
              if (!bucket)
                throw new Error(`Missing ${intent.bucket_kind} bucket`);
              await s3.send(
                new DeleteObjectCommand({
                  Bucket: bucket,
                  Key: intent.object_key,
                }),
              );
              await queryRunner.query(
                `UPDATE media_deletion_intents SET completed_at = NOW(), attempts = attempts + 1, last_error = NULL, updated_at = NOW() WHERE id = $1`,
                [intent.id],
              );
              // Release accounting only after every owned deletion intent has
              // completed and no retained published binding remains for this upload.
              await queryRunner.query(
                `UPDATE deployment_upload_reservations r SET state = 'released', updated_at = NOW()
             WHERE r.environment = $1 AND r.upload_id = (SELECT upload_id FROM media_deletion_intents WHERE id = $2)
               AND r.state IN ('reserved', 'complete')
               AND NOT EXISTS (SELECT 1 FROM media_deletion_intents i WHERE i.upload_id = r.upload_id AND i.completed_at IS NULL)
               AND NOT EXISTS (SELECT 1 FROM "media_uploads" m WHERE m.id = r.upload_id AND m."publishedKey" IS NOT NULL)`,
                [environment, intent.id],
              );
            } catch (error) {
              await queryRunner.query(
                `UPDATE media_deletion_intents SET attempts = attempts + 1, last_error = $2, updated_at = NOW() WHERE id = $1`,
                [
                  intent.id,
                  error instanceof Error
                    ? error.message.slice(0, 1000)
                    : 'storage deletion failed',
                ],
              );
              throw error;
            }
          }
        } finally {
          s3.destroy();
        }
        // Keep bounded operational tables from becoming a new capacity gate. All
        // admission windows are at most one day, so seven days preserves a useful
        // diagnostic horizon without deleting a current budget. Reservations stay
        // until explicitly released and all deletion work is reconciled.
        await queryRunner.query(
          `DELETE FROM deployment_admission_windows
       WHERE window_starts_at < NOW() - INTERVAL '7 days'`,
        );
        await queryRunner.query(
          `DELETE FROM deployment_operation_leases
       WHERE expires_at < NOW() - INTERVAL '7 days'`,
        );
        await queryRunner.query(
          `DELETE FROM deployment_upload_reservations r
       WHERE r.environment = $1
         AND r.state = 'released'
         AND r.updated_at < NOW() - INTERVAL '7 days'
         AND NOT EXISTS (
           SELECT 1 FROM media_deletion_intents i
           WHERE i.environment = r.environment
             AND i.upload_id = r.upload_id
             AND i.completed_at IS NULL
         )`,
          [environment],
        );
        await queryRunner.query(
          `INSERT INTO deployment_maintenance_state (environment, cleanup_last_succeeded_at, cleanup_last_failed_at, cleanup_last_error, updated_at)
       VALUES ($1, NOW(), NULL, NULL, NOW())
       ON CONFLICT (environment) DO UPDATE SET cleanup_last_succeeded_at = EXCLUDED.cleanup_last_succeeded_at, cleanup_last_failed_at = NULL, cleanup_last_error = NULL, updated_at = NOW()`,
          [environment],
        );
      },
    );
  } catch (error) {
    await dataSource
      .query(
        `INSERT INTO deployment_maintenance_state (environment, cleanup_last_failed_at, cleanup_last_error, updated_at)
       VALUES ($1, NOW(), $2, NOW())
       ON CONFLICT (environment) DO UPDATE SET cleanup_last_failed_at = EXCLUDED.cleanup_last_failed_at, cleanup_last_error = EXCLUDED.cleanup_last_error, updated_at = NOW()`,
        [
          environment,
          error instanceof Error
            ? error.message.slice(0, 1000)
            : 'cleanup failed',
        ],
      )
      .catch(() => undefined);
    throw error;
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to cleanup demo users:', error);
  process.exit(1);
});
