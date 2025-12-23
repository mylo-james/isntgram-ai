import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFile } from 'fs/promises';
import { join } from 'path';

async function main() {
  // Ensure the AppModule uses SQLite (in-memory) so this can run without external infra.
  process.env.NODE_ENV = 'test';
  // AuthModule/JwtStrategy require a JWT secret at bootstrap time. This is safe for spec generation
  // and avoids requiring CI to inject secrets for a non-runtime task.
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'openapi_gen_secret';

  // Import after env is set so ConfigModule validation sees it.
  const { AppModule } = await import('../src/app.module');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
    abortOnError: false,
  });
  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Isntgram API')
    .setDescription('Isntgram API documentation')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  const outputPath = join(__dirname, '..', 'openapi.json');
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

  await app.close();

  // eslint-disable-next-line no-console
  console.log(`✅ Wrote OpenAPI spec: ${outputPath}`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to generate OpenAPI spec:', error);
  process.exit(1);
});
