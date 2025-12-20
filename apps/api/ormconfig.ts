import { DataSource } from 'typeorm';
import { User } from './src/users/entities/user.entity';
import { Post } from './src/posts/entities/post.entity';
import { Follow } from './src/follows/entities/follow.entity';
import { getPostgresSslOptions } from './src/config/postgres-ssl';

const nodeEnv = process.env.NODE_ENV ?? 'development';
const databaseUrl =
  process.env.DATABASE_URL ||
  (nodeEnv === 'production'
    ? undefined
    : 'postgresql://postgres:password@localhost:5432/isntgram');

if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set');
}

export default new DataSource({
  type: 'postgres',
  url: databaseUrl,
  entities: [User, Post, Follow],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: nodeEnv === 'development',
  ssl: getPostgresSslOptions(process.env),
});
