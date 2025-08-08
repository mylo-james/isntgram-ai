import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { User } from './users/entities/user.entity';
import { AuthModule } from './auth/auth.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

function getDatabaseModules() {
  if (process.env.SKIP_DB === 'true') {
    return [];
  }

  // Use SQLite for local tests, PostgreSQL for production and CI
  const isLocalTest = process.env.NODE_ENV === 'test' && !process.env.CI;
  const databaseConfig = isLocalTest
    ? {
        type: 'sqlite' as const,
        database: ':memory:',
        entities: [User],
        synchronize: true,
        logging: false,
      }
    : {
        type: 'postgres' as const,
        url:
          process.env.DATABASE_URL ||
          'postgresql://postgres:password@localhost:5432/isntgram',
        entities: [User],
        synchronize: process.env.NODE_ENV === 'development',
        logging: process.env.NODE_ENV === 'development',
        ssl:
          process.env.NODE_ENV === 'production'
            ? { rejectUnauthorized: false }
            : false,
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
  return [AuthModule];
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 10, // 10 requests per minute
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
