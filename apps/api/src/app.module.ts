import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { User } from './users/entities/user.entity';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { Follows } from './follows/entities/follows.entity';
import { FollowsModule } from './follows/follows.module';
import { Post as PostEntity } from './posts/entities/post.entity';
import { PostsModule } from './posts/posts.module';
import { SearchModule } from './search/search.module';
import { LikesModule } from './likes/likes.module';
import { CommentsModule } from './comments/comments.module';
import { PostLike } from './likes/entities/post-like.entity';
import { Comment } from './comments/entities/comment.entity';
import { AiModule } from './ai/ai.module';

function getDatabaseModules() {
  if (process.env.SKIP_DB === 'true') {
    return [];
  }

  // Use SQLite for tests (including CI E2E), PostgreSQL for other environments
  const isTestEnv = process.env.NODE_ENV === 'test';
  const databaseConfig = isTestEnv
    ? {
        type: 'sqlite' as const,
        database: ':memory:',
        entities: [User, Follows, PostEntity, PostLike, Comment],
        synchronize: true,
        logging: false,
      }
    : {
        type: 'postgres' as const,
        url: (() => {
          const dbUrl = process.env.DATABASE_URL;
          if (!dbUrl) {
            throw new Error(
              'DATABASE_URL must be set for non-test environments. See ENVIRONMENT.md for details.',
            );
          }
          return dbUrl;
        })(),
        entities: [User, Follows, PostEntity, PostLike, Comment],
        synchronize: process.env.NODE_ENV === 'development',
        logging: process.env.NODE_ENV === 'development',
        ssl: (() => {
          const sslFlag = process.env.DB_SSL;
          if (sslFlag === 'true') return { rejectUnauthorized: false };
          if (sslFlag === 'false') return false;
          return process.env.NODE_ENV === 'production'
            ? { rejectUnauthorized: false }
            : false;
        })(),
      };

  return [
    TypeOrmModule.forRootAsync({
      useFactory: () => databaseConfig,
    }),
  ];
}

function getFeatureModules() {
  if (process.env.SKIP_DB === 'true') {
    return [];
  }
  return [
    AuthModule,
    UsersModule,
    FollowsModule,
    PostsModule,
    LikesModule,
    CommentsModule,
    SearchModule,
    AiModule,
  ];
}

function getThrottleConfig() {
  const defaultTtl = 60_000; // 1 minute
  const defaultLimit = 10; // 10 requests per minute

  const ttl = Number.parseInt(process.env.THROTTLE_TTL ?? `${defaultTtl}`, 10);
  const limit = Number.parseInt(
    process.env.THROTTLE_LIMIT ?? `${defaultLimit}`,
    10,
  );

  return {
    ttl: Number.isFinite(ttl) ? ttl : defaultTtl,
    limit: Number.isFinite(limit) ? limit : defaultLimit,
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRoot([
      {
        ...getThrottleConfig(),
      },
    ]),
    ...getDatabaseModules(),
    ...getFeatureModules(),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
