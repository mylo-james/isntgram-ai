import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PostsModule } from './posts/posts.module';
import { FollowsModule } from './follows/follows.module';
import { MediaModule } from './media/media.module';
import { AiModule } from './ai/ai.module';
import { MetricsModule } from './metrics/metrics.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { join } from 'path';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { MetricsInterceptor } from './metrics/metrics.interceptor';
import { HttpLoggingInterceptor } from './common/interceptors/http-logging.interceptor';
import { validateEnv } from './config/env.validation';
import { getPostgresSslOptions } from './config/postgres-ssl';

function getDatabaseModules() {
  if (process.env.SKIP_DB === 'true') {
    return [];
  }

  // Use SQLite for tests (including CI E2E), PostgreSQL for other environments
  const isTestEnv = process.env.NODE_ENV === 'test';
  const baseConfig = {
    autoLoadEntities: true,
    migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
  };

  const databaseConfig = isTestEnv
    ? {
        type: 'sqlite' as const,
        database: ':memory:',
        synchronize: true,
        logging: false,
        ...baseConfig,
      }
    : {
        type: 'postgres' as const,
        url:
          process.env.DATABASE_URL ||
          'postgresql://postgres:password@localhost:5432/isntgram',
        synchronize: false,
        migrationsRun: true,
        logging: process.env.NODE_ENV === 'development',
        ssl: getPostgresSslOptions(process.env),
        ...baseConfig,
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
    PostsModule,
    FollowsModule,
    MediaModule,
    AiModule,
  ];
}

function getThrottlerOptions() {
  const ttl = Number(process.env.THROTTLER_TTL ?? 60000);
  const defaultLimit = process.env.NODE_ENV === 'test' ? 10000 : 10;
  const limit = Number(process.env.THROTTLER_LIMIT ?? defaultLimit);

  return [
    {
      ttl: Number.isFinite(ttl) ? ttl : 60000,
      limit: Number.isFinite(limit) ? limit : defaultLimit,
    },
  ];
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot(getThrottlerOptions()),
    MetricsModule,
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
    RequestIdMiddleware,
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpLoggingInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
