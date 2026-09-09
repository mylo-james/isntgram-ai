import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { UsersModule } from '../src/users/users.module';
import { AuthModule } from '../src/auth/auth.module';
import { User } from '../src/users/entities/user.entity';
import { Post } from '../src/posts/entities/post.entity';
import { Like } from '../src/posts/entities/like.entity';
import { Comment } from '../src/posts/entities/comment.entity';
import { Follow } from '../src/follows/entities/follow.entity';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ConfigModule } from '@nestjs/config';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { selectTestDatabase } = require('./test-database-target.cjs') as {
  selectTestDatabase: (
    env: NodeJS.ProcessEnv,
  ) => { kind: 'sqlite' } | { kind: 'postgres'; url: string };
};

describe('Users Integration Tests', () => {
  let app: INestApplication;
  let isPostgres = false;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-jwt-secret';
    const selectedDatabase = selectTestDatabase(process.env);
    isPostgres = selectedDatabase.kind === 'postgres';
    const databaseConnection =
      selectedDatabase.kind === 'postgres'
        ? { type: 'postgres' as const, url: selectedDatabase.url }
        : { type: 'sqlite' as const, database: ':memory:' };
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          ...databaseConnection,
          entities: [User, Post, Like, Comment, Follow],
          synchronize: true,
        }),
        // Disable throttling for tests
        ThrottlerModule.forRoot([
          {
            ttl: 60000,
            limit: 1000, // Very high limit for tests
          },
        ]),
        AuthModule,
        UsersModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    // Keep one loopback listener for the suite; Supertest must not close it per request.
    await app.listen(0, '127.0.0.1');
  });

  beforeEach(async () => {
    if (isPostgres) {
      await app.get(DataSource).query('TRUNCATE TABLE "users" CASCADE');
    }
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('should check username availability, update profile with auth, and protect PII', async () => {
    // Create a user via register
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'user@example.com',
        username: 'user1',
        fullName: 'User One',
        password: 'Password123',
      })
      .expect(201);

    // Login to get access token
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'user@example.com',
        password: 'Password123',
      })
      .expect(200);

    const token = loginResponse.body.accessToken as string;

    // Check username availability (public)
    const checkRes = await request(app.getHttpServer())
      .get('/api/users/check-username/user2')
      .expect(200);
    expect(checkRes.body).toEqual({ available: true });

    // Update profile (requires auth)
    const updateRes = await request(app.getHttpServer())
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'New Name', username: 'user2' })
      .expect(200);

    expect(updateRes.body).toHaveProperty('username', 'user2');
    expect(updateRes.body).toHaveProperty('fullName', 'New Name');
    expect(updateRes.body).toHaveProperty('email', 'user@example.com');

    // Public profile should not expose email
    const publicRes = await request(app.getHttpServer())
      .get('/api/users/user2')
      .expect(200);
    expect(publicRes.body).not.toHaveProperty('email');
  });

  it('should reject /users/me without auth', async () => {
    await request(app.getHttpServer()).get('/api/users/me').expect(401);
  });

  it('should reject update payloads with unexpected fields', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'extra@example.com',
        username: 'extra',
        fullName: 'Extra User',
        password: 'Password123',
      })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'extra@example.com',
        password: 'Password123',
      })
      .expect(200);

    const token = loginResponse.body.accessToken as string;

    await request(app.getHttpServer())
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Extra User Updated',
        username: 'extra_updated',
        id: 'not-allowed',
      })
      .expect(400);
  });
});
