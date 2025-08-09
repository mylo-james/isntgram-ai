import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Enable CORS
  app.enableCors({
    origin: [
      configService.get('CORS_ORIGIN', 'http://localhost:3000'),
      'http://127.0.0.1:3000',
    ],
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
  logger.log(`📊 Environment: ${configService.get('NODE_ENV', 'development')}`);
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('Failed to start application:', error);
  process.exit(1);
});
