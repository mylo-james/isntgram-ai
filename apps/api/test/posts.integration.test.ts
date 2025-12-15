import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AuthModule } from '../src/auth/auth.module';
import { User } from '../src/users/entities/user.entity';
import { Follows } from '../src/follows/entities/follows.entity';
import { Post as PostEntity } from '../src/posts/entities/post.entity';
import { PostLike } from '../src/likes/entities/post-like.entity';
import { Comment } from '../src/comments/entities/comment.entity';
import { PostsModule } from '../src/posts/posts.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ConfigModule } from '@nestjs/config';

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

describe('Posts Integration Tests', () => {
  let app: INestApplication;
  let dataSource: DataSource;

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
        // Disable throttling for tests
        ThrottlerModule.forRoot([
          {
            ttl: 60000,
            limit: 1000,
          },
        ]),
        AuthModule,
        PostsModule,
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
      await queryRunner.manager.query('DELETE FROM posts');
      await queryRunner.manager.query('DELETE FROM users');
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create a post and return it in the feed', async () => {
    const token = await registerAndLogin(app, {
      email: 'a@example.com',
      username: 'usera',
      fullName: 'User A',
      password: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
    });

    const created = await request(app.getHttpServer())
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Hello from a post' })
      .expect(201);

    expect(created.body).toHaveProperty('id');
    expect(created.body).toHaveProperty('content', 'Hello from a post');
    expect(created.body).toHaveProperty('author');
    expect(created.body.author).toHaveProperty('username', 'usera');

    const feed = await request(app.getHttpServer())
      .get('/api/posts/feed')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(feed.body).toHaveProperty('posts');
    expect(feed.body.posts.length).toBeGreaterThan(0);
    expect(feed.body.posts[0]).toHaveProperty('content', 'Hello from a post');
  });

  it('should forbid demo users from creating posts', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/demo')
      .send({})
      .expect(200);

    const signin = await request(app.getHttpServer())
      .post('/api/auth/signin')
      .send({
        email: process.env.DEMO_EMAIL || 'demo@isntgram.ai',
        password: process.env.DEMO_PASSWORD || 'changeme',
      })
      .expect(200);
    const token = signin.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Demo should not be allowed to post' })
      .expect(403);

    expect(res.body).toHaveProperty('message');
  });
});
