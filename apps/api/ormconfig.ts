import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from './src/users/entities/user.entity';
import { Post } from './src/posts/entities/post.entity';
import { Follow } from './src/follows/entities/follow.entity';

const configService = new ConfigService();

export default new DataSource({
  type: 'postgres',
  url: configService.get('DATABASE_URL'),
  entities: [User, Post, Follow],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: configService.get('NODE_ENV') === 'development',
  ssl:
    configService.get('NODE_ENV') === 'production'
      ? { rejectUnauthorized: false }
      : false,
});
