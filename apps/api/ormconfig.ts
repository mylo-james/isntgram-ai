import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from './src/users/entities/user.entity';
import { Follows } from './src/follows/entities/follows.entity';
import { Post as PostEntity } from './src/posts/entities/post.entity';
import { PostLike } from './src/likes/entities/post-like.entity';
import { Comment } from './src/comments/entities/comment.entity';

const configService = new ConfigService();

export default new DataSource({
  type: 'postgres',
  url: configService.get('DATABASE_URL'),
  entities: [User, Follows, PostEntity, PostLike, Comment],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: configService.get('NODE_ENV') === 'development',
  ssl: (() => {
    const sslFlag = configService.get<string>('DB_SSL');
    if (sslFlag === 'true') return { rejectUnauthorized: false };
    if (sslFlag === 'false') return false;
    return configService.get('NODE_ENV') === 'production'
      ? { rejectUnauthorized: false }
      : false;
  })(),
});
