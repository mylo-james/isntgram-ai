import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ConfigModule } from '@nestjs/config';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { AuthModule } from '../src/auth/auth.module';
import { AiModule } from '../src/ai/ai.module';
import { User } from '../src/users/entities/user.entity';
import { Follows } from '../src/follows/entities/follows.entity';
import { Post as PostEntity } from '../src/posts/entities/post.entity';
import { PostLike } from '../src/likes/entities/post-like.entity';
import { Comment } from '../src/comments/entities/comment.entity';

async function registerAndLogin(
  app: INestApplication,
  data: { email: string; username: string; fullName: string; password: string },
) {
  await request(app.getHttpServer())
    .post('/api/auth/register')
    .send(data)
    .expect(201);
  const signin = await request(app.getHttpServer())
    .post('/api/auth/signin')
    .send({ email: data.email, password: data.password })
    .expect(200);
  return signin.body.accessToken as string;
}

describe('AI Integration Tests', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const originalFetch = global.fetch;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [User, Follows, PostEntity, PostLike, Comment],
          synchronize: true,
          logging: false,
        }),
        ThrottlerModule.forRoot([
          {
            ttl: 60000,
            limit: 1000,
          },
        ]),
        AuthModule,
        AiModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  beforeEach(async () => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.query('DELETE FROM follows');
      await queryRunner.manager.query('DELETE FROM users');
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    await app.close();
  });

  it('returns 503 when OPENAI_API_KEY is not configured', async () => {
    const token = await registerAndLogin(app, {
      email: 'ai1@example.com',
      username: 'ai1',
      fullName: 'AI One',
      password: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
    });

    const res = await request(app.getHttpServer())
      .post('/api/ai/captions')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'A sunny day at the beach', tone: 'friendly', count: 2 })
      .expect(503);

    expect(res.body.message).toContain('OPENAI_API_KEY');
  });

  it('returns caption suggestions when provider responds successfully', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_MODEL = 'test-model';

    const token = await registerAndLogin(app, {
      email: 'ai2@example.com',
      username: 'ai2',
      fullName: 'AI Two',
      password: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
    });

    const mockProviderResponse = {
      output: [
        {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'output_text',
              text: JSON.stringify({
                suggestions: ['Hello world', 'Another caption'],
              }),
            },
          ],
        },
      ],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockProviderResponse,
    } as unknown as Response);

    const res = await request(app.getHttpServer())
      .post('/api/ai/captions')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'Testing captions', tone: 'funny', count: 2 })
      .expect(201);

    expect(res.body).toEqual({
      suggestions: ['Hello world', 'Another caption'],
    });
    expect(global.fetch).toHaveBeenCalled();
  });
});
