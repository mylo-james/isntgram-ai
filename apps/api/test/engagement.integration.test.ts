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
import { LikesModule } from '../src/likes/likes.module';
import { CommentsModule } from '../src/comments/comments.module';
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

describe('Engagement Integration Tests (likes + comments)', () => {
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
        ThrottlerModule.forRoot([{ ttl: 60000, limit: 1000 }]),
        AuthModule,
        PostsModule,
        LikesModule,
        CommentsModule,
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
      await queryRunner.manager.query('DELETE FROM post_likes');
      await queryRunner.manager.query('DELETE FROM comments');
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

  it('likes/unlikes posts and creates/deletes comments', async () => {
    const token = await registerAndLogin(app, {
      email: 'engagement@example.com',
      username: 'engagementuser',
      fullName: 'Engagement User',
      password: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
    });

    const created = await request(app.getHttpServer())
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Hello engagement' })
      .expect(201);
    const postId = created.body.id as string;

    const likeRes = await request(app.getHttpServer())
      .post(`/api/posts/${postId}/like`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);
    expect(likeRes.body).toEqual({ likedByMe: true, likesCount: 1 });

    const detail = await request(app.getHttpServer())
      .get(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(detail.body).toHaveProperty('likedByMe', true);
    expect(detail.body).toHaveProperty('likesCount', 1);

    const commentRes = await request(app.getHttpServer())
      .post(`/api/posts/${postId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Nice post' })
      .expect(201);
    expect(commentRes.body).toHaveProperty('id');
    expect(commentRes.body).toHaveProperty('text', 'Nice post');
    expect(commentRes.body).toHaveProperty('author');

    const listRes = await request(app.getHttpServer())
      .get(`/api/posts/${postId}/comments`)
      .expect(200);
    expect(listRes.body).toHaveProperty('comments');
    expect(listRes.body.comments.length).toBe(1);

    await request(app.getHttpServer())
      .delete(`/api/posts/${postId}/comments/${commentRes.body.id as string}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const unlikeRes = await request(app.getHttpServer())
      .delete(`/api/posts/${postId}/like`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(unlikeRes.body).toEqual({ likedByMe: false, likesCount: 0 });
  });
});
