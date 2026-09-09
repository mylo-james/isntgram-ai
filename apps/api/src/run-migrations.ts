import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { join } from 'path';
import { User } from './users/entities/user.entity';
import { Post } from './posts/entities/post.entity';
import { Like } from './posts/entities/like.entity';
import { Comment } from './posts/entities/comment.entity';
import { CommentLike } from './posts/entities/comment-like.entity';
import { Follow } from './follows/entities/follow.entity';
import { Notification } from './notifications/entities/notification.entity';
import { MediaUpload } from './media/entities/media-upload.entity';
import { getPostgresSslOptions } from './config/postgres-ssl';
import { withMaintenanceLock } from './common/deployment/maintenance-lock';

const MAX_CONNECT_ATTEMPTS = 3;
const MAX_CONNECT_WAIT_MS = 60_000;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function initializeWithRetry(dataSource: DataSource) {
  let lastError: unknown;
  const startedAt = Date.now();
  for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt += 1) {
    try {
      await dataSource.initialize();
      return;
    } catch (error) {
      lastError = error;
      if (dataSource.isInitialized) await dataSource.destroy();
      if (attempt === MAX_CONNECT_ATTEMPTS) break;
      const wait = Math.min(1_000 * 2 ** (attempt - 1), 10_000);
      if (Date.now() - startedAt + wait > MAX_CONNECT_WAIT_MS) break;
      await delay(wait);
    }
  }
  throw lastError;
}

async function main() {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const databaseUrl =
    process.env.DATABASE_DIRECT_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL must be set');
  }
  if (nodeEnv === 'production' && !process.env.DATABASE_DIRECT_URL) {
    throw new Error(
      'DATABASE_DIRECT_URL must be set for production migrations',
    );
  }
  const environment = process.env.DEPLOYMENT_ENV ?? nodeEnv;

  const dataSource = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities: [
      User,
      Post,
      Like,
      Comment,
      CommentLike,
      Follow,
      Notification,
      MediaUpload,
    ],
    // Migration unit tests live beside the migration source. Match the
    // timestamp-name convention so the reconciler never imports Jest files.
    migrations: [join(__dirname, 'migrations', '!(*.test).{ts,js}')],
    synchronize: false,
    logging: (process.env.NODE_ENV ?? 'development') === 'development',
    ssl: getPostgresSslOptions(process.env),
  });

  await initializeWithRetry(dataSource);

  try {
    await withMaintenanceLock(
      dataSource,
      environment,
      'migration',
      async () => {
        // TypeORM records completed migrations in its migrations table. If an
        // invocation times out after the provider reports an unknown outcome,
        // reconnecting here reads that durable record before it considers any
        // pending DDL. It never replays arbitrary DDL from a failed shell run.
        const migrationTable = await dataSource.query(
          "SELECT to_regclass('public.migrations') AS name",
        );
        const before = migrationTable[0]?.name
          ? await dataSource.query(
              'SELECT timestamp, name FROM migrations ORDER BY timestamp',
            )
          : [];
        const ran = await dataSource.runMigrations();
        const after = await dataSource.query(
          'SELECT timestamp, name FROM migrations ORDER BY timestamp',
        );
        console.log(
          `Ran ${ran.length} migrations (recorded before=${before.length}, after=${after.length})`,
        );
      },
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('Failed to run migrations:', error);
  process.exit(1);
});
