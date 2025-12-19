import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { AppModule } from '../src/app.module';

async function main() {
  // Ensure the AppModule uses SQLite (in-memory) so this can run without external infra.
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';

  const app = await NestFactory.create(AppModule, { logger: false });
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
