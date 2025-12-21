import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { join } from 'path';
import { User } from './users/entities/user.entity';
import { Post } from './posts/entities/post.entity';
import { Follow } from './follows/entities/follow.entity';
import { getPostgresSslOptions } from './config/postgres-ssl';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL must be set');
  }

  const dataSource = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities: [User, Post, Follow],
    migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
    synchronize: false,
    logging: (process.env.NODE_ENV ?? 'development') === 'development',
    ssl: getPostgresSslOptions(process.env),
  });

  await dataSource.initialize();

  try {
    const ran = await dataSource.runMigrations();
    console.log(`✅ Ran ${ran.length} migrations`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('Failed to run migrations:', error);
  process.exit(1);
});
