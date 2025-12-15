import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ConfigModule } from '@nestjs/config';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { AuthModule } from '../src/auth/auth.module';
import { PostsModule } from '../src/posts/posts.module';
import { SearchModule } from '../src/search/search.module';
import { LikesModule } from '../src/likes/likes.module';
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

describe('Search Integration Tests', () => {
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
        ThrottlerModule.forRoot([
          {
            ttl: 60000,
            limit: 1000,
          },
        ]),
        AuthModule,
        PostsModule,
        LikesModule,
        SearchModule,
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

  it('searches users by username/fullName and posts by hashtag', async () => {
    const token = await registerAndLogin(app, {
      email: 'search@example.com',
      username: 'searchuser',
      fullName: 'Search User',
      password: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
    });

    await request(app.getHttpServer())
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Hello #playwright from search' })
      .expect(201);

    const usersRes = await request(app.getHttpServer())
      .get('/api/search')
      .query({ q: 'search', type: 'users', page: 1, limit: 10 })
      .expect(200);

    expect(usersRes.body).toHaveProperty('users');
    expect(usersRes.body.users[0]).toHaveProperty('username', 'searchuser');

    const postsRes = await request(app.getHttpServer())
      .get('/api/search')
      .query({ q: '#playwright', type: 'posts', page: 1, limit: 10 })
      .expect(200);

    expect(postsRes.body).toHaveProperty('posts');
    expect(postsRes.body.posts[0]).toHaveProperty('content');
    expect(postsRes.body.posts[0].content).toContain('#playwright');
  });

  it('sets likedByMe when authenticated', async () => {
    const token = await registerAndLogin(app, {
      email: 'search-liked@example.com',
      username: 'searchliked',
      fullName: 'Search Liked',
      password: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
    });

    const created = await request(app.getHttpServer())
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'I like this #liked' })
      .expect(201);

    const postId = created.body.id as string;
    expect(postId).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/api/posts/${postId}/like`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/api/search')
      .set('Authorization', `Bearer ${token}`)
      .query({ q: '#liked', type: 'posts', page: 1, limit: 10 })
      .expect(200);

    expect(res.body.posts[0]).toMatchObject({ id: postId, likedByMe: true });
  });
});
