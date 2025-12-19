import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { PostsModule } from '../src/posts/posts.module';
import { FollowsModule } from '../src/follows/follows.module';
import { User } from '../src/users/entities/user.entity';
import { Post } from '../src/posts/entities/post.entity';
import { Follow } from '../src/follows/entities/follow.entity';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ConfigModule } from '@nestjs/config';

describe('Posts Integration Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-jwt-secret';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [User, Post, Follow],
          synchronize: true,
        }),
        ThrottlerModule.forRoot([
          {
            ttl: 60000,
            limit: 1000,
          },
        ]),
        AuthModule,
        UsersModule,
        PostsModule,
        FollowsModule,
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
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create posts and populate feed for followers', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'author@example.com',
        username: 'author',
        fullName: 'Author One',
        password: 'Password123',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'reader@example.com',
        username: 'reader',
        fullName: 'Reader Two',
        password: 'Password123',
      })
      .expect(201);

    const authorLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'author@example.com', password: 'Password123' })
      .expect(200);

    const readerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'reader@example.com', password: 'Password123' })
      .expect(200);

    const authorToken = authorLogin.body.accessToken;
    const readerToken = readerLogin.body.accessToken;

    await request(app.getHttpServer())
      .post('/api/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ content: 'Hello feed' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/follows/author')
      .set('Authorization', `Bearer ${readerToken}`)
      .expect(201);

    const feedResponse = await request(app.getHttpServer())
      .get('/api/posts/feed')
      .set('Authorization', `Bearer ${readerToken}`)
      .expect(200);

    expect(feedResponse.body.items).toHaveLength(1);
    expect(feedResponse.body.items[0].content).toBe('Hello feed');
  });

  it('should require auth for feed', async () => {
    await request(app.getHttpServer()).get('/api/posts/feed').expect(401);
  });
});
