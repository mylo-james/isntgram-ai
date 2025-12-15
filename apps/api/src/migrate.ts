import 'reflect-metadata';
import path from 'node:path';
import { DataSource } from 'typeorm';
import { User } from './users/entities/user.entity';
import { Follows } from './follows/entities/follows.entity';
import { Post as PostEntity } from './posts/entities/post.entity';
import { PostLike } from './likes/entities/post-like.entity';
import { Comment } from './comments/entities/comment.entity';

async function runMigrations(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL must be set to run migrations. See ENVIRONMENT.md and apps/api/env.example.',
    );
  }

  const dataSource = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities: [User, Follows, PostEntity, PostLike, Comment],
    migrations: [path.join(__dirname, 'migrations/*.js')],
    synchronize: false,
    logging: process.env.NODE_ENV === 'development',
    ssl: (() => {
      const sslFlag = process.env.DB_SSL;
      if (sslFlag === 'true') return { rejectUnauthorized: false };
      if (sslFlag === 'false') return false;
      return process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false;
    })(),
  });

  await dataSource.initialize();
  const migrations = await dataSource.runMigrations();
  await dataSource.destroy();

  // eslint-disable-next-line no-console
  console.log(`✅ Migrations complete (${migrations.length} applied)`);
}

runMigrations().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('❌ Migration failed', error);
  process.exit(1);
});
