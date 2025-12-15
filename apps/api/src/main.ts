import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as Sentry from '@sentry/node';
import { createRequestLoggerMiddleware } from './common/middleware/request-logger.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const nodeEnv = configService.get('NODE_ENV', 'development');
  const logger = new Logger('Bootstrap');

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'none'"],
          baseUri: ["'none'"],
          frameAncestors: ["'none'"],
          formAction: ["'none'"],
        },
      },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  const sentryDsn = configService.get<string>('SENTRY_DSN');
  if (sentryDsn && nodeEnv !== 'test') {
    Sentry.init({
      dsn: sentryDsn,
      environment: nodeEnv,
      tracesSampleRate: Number(
        configService.get('SENTRY_TRACES_SAMPLE_RATE') ?? 0,
      ),
    });
    logger.log('Sentry error tracking enabled');
  }

  // Swagger (disabled in production)
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Isntgram API')
      .setDescription('Isntgram API documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Enable CORS
  const corsOrigin = configService.get<string>('CORS_ORIGIN');
  const allowedOrigins =
    nodeEnv === 'production'
      ? (() => {
          if (!corsOrigin) {
            throw new Error('CORS_ORIGIN must be set in production');
          }
          return [corsOrigin];
        })()
      : [corsOrigin || 'http://localhost:3000', 'http://127.0.0.1:3000'];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Structured HTTP request logging (production by default)
  const enableRequestLogging =
    nodeEnv === 'production' ||
    configService.get<string>('LOG_REQUESTS') === 'true';
  if (enableRequestLogging && nodeEnv !== 'test') {
    app.use(
      createRequestLoggerMiddleware({
        nodeEnv,
        projectId: process.env.GOOGLE_CLOUD_PROJECT,
      }),
    );
    logger.log('HTTP request logging enabled');
  }

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global prefix
  app.setGlobalPrefix('api');

  // Graceful shutdown
  const gracefulShutdown = (signal: string) => {
    logger.log(`Received ${signal}. Starting graceful shutdown...`);
    app.close().then(() => {
      logger.log('Graceful shutdown completed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  const port = configService.get('PORT', 3001);
  const host = configService.get('HOST', '0.0.0.0');
  await app.listen(port, host);

  logger.log(`🚀 Application is running on: http://${host}:${port}`);
  logger.log(`📊 Environment: ${nodeEnv}`);
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('Failed to start application:', error);
  process.exit(1);
});
