import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { assertDeploymentTarget } from './common/deployment/target';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const nodeEnv = configService.get('NODE_ENV', 'development');
  const deploymentEnvironment = configService.get<string>('DEPLOYMENT_ENV');
  if (['preview', 'production'].includes(deploymentEnvironment ?? '')) {
    await assertDeploymentTarget(
      app.get(DataSource),
      deploymentEnvironment!,
      'api',
    );
  }
  if (process.env.VERCEL === '1') {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

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
  const logger = new Logger('Bootstrap');

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

  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Isntgram API')
      .setDescription('Isntgram API documentation')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      customSiteTitle: 'Isntgram API Docs',
    });
  }

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
