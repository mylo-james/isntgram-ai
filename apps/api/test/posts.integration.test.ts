import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { User } from '../src/users/entities/user.entity';
import { Post } from '../src/posts/entities/post.entity';
import { Follows } from '../src/follows/entities/follows.entity';
import { PostsModule } from '../src/posts/posts.module';
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { APP_FILTER } from '@nestjs/core';

describe('Posts Integration Tests', () => {
  let app: INestApplication;
  let authToken: string;
  let userId: string;
  let postId: string;

  const testUser = {
    username: 'testuser',
    email: 'test@example.com',
    fullName: 'Test User',
    password: 'TestPassword123!',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [User, Post, Follows],
          synchronize: true,
          logging: false,
        }),
        ThrottlerModule.forRoot([
          {
            ttl: 60000,
            limit: 10,
          },
        ]),
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '1h' },
        }),
        AuthModule,
        UsersModule,
        PostsModule,
      ],
      providers: [
        {
          provide: APP_FILTER,
          useClass: GlobalExceptionFilter,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Match production global prefix
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();

    // Register a user and get auth token
    const registerResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(testUser)
      .expect(201);

    userId = registerResponse.body.user.id;

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      })
      .expect(200);

    authToken = loginResponse.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /posts', () => {
    it('should create a post successfully', async () => {
      const createPostDto = {
        caption: 'Test post caption',
        imageUrl: 'https://example.com/image.jpg',
      };

      const response = await request(app.getHttpServer())
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createPostDto)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        userId: userId,
        caption: createPostDto.caption,
        imageUrl: createPostDto.imageUrl,
        likesCount: 0,
        commentsCount: 0,
        user: {
          id: userId,
          username: testUser.username,
          fullName: testUser.fullName,
        },
      });

      postId = response.body.id;
    });

    it('should create a post without caption', async () => {
      const createPostDto = {
        imageUrl: 'https://example.com/image2.jpg',
      };

      const response = await request(app.getHttpServer())
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createPostDto)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        userId: userId,
        caption: undefined,
        imageUrl: createPostDto.imageUrl,
        likesCount: 0,
        commentsCount: 0,
      });
    });

    it('should fail to create post without authentication', async () => {
      const createPostDto = {
        caption: 'Test post caption',
        imageUrl: 'https://example.com/image.jpg',
      };

      await request(app.getHttpServer())
        .post('/api/posts')
        .send(createPostDto)
        .expect(401);
    });

    it('should fail to create post without image URL', async () => {
      const createPostDto = {
        caption: 'Test post caption',
      };

      await request(app.getHttpServer())
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createPostDto)
        .expect(400);
    });

    it('should fail to create post with invalid image URL', async () => {
      const createPostDto = {
        caption: 'Test post caption',
        imageUrl: 'invalid-url',
      };

      await request(app.getHttpServer())
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createPostDto)
        .expect(400);
    });

    it('should fail to create post with caption too long', async () => {
      const createPostDto = {
        caption: 'a'.repeat(2201), // Exceeds 2200 character limit
        imageUrl: 'https://example.com/image.jpg',
      };

      await request(app.getHttpServer())
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createPostDto)
        .expect(400);
    });
  });

  describe('GET /posts/:id', () => {
    it('should get a post successfully', async () => {
      const response = await request(app.getHttpServer())
        .get(`/posts/${postId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: postId,
        userId: userId,
        caption: 'Test post caption',
        imageUrl: 'https://example.com/image.jpg',
        likesCount: 0,
        commentsCount: 0,
        user: {
          id: userId,
          username: testUser.username,
          fullName: testUser.fullName,
        },
      });
    });

    it('should return 404 for non-existent post', async () => {
      await request(app.getHttpServer())
        .get('/api/posts/non-existent-id')
        .expect(404);
    });
  });

  describe('GET /posts/user/:username', () => {
    it('should get user posts successfully', async () => {
      const response = await request(app.getHttpServer())
        .get(`/posts/user/${testUser.username}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toMatchObject({
        id: expect.any(String),
        userId: userId,
        user: {
          id: userId,
          username: testUser.username,
          fullName: testUser.fullName,
        },
      });
    });

    it('should handle pagination parameters', async () => {
      const response = await request(app.getHttpServer())
        .get(`/posts/user/${testUser.username}?page=1&limit=1`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeLessThanOrEqual(1);
    });

    it('should return empty array for non-existent user', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/posts/user/nonexistentuser')
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('GET /posts', () => {
    it('should get feed successfully', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toMatchObject({
        id: expect.any(String),
        userId: expect.any(String),
        user: {
          id: expect.any(String),
          username: expect.any(String),
          fullName: expect.any(String),
        },
      });
    });

    it('should handle pagination parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/posts?page=1&limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeLessThanOrEqual(1);
    });

    it('should fail to get feed without authentication', async () => {
      await request(app.getHttpServer())
        .get('/api/posts')
        .expect(401);
    });
  });

  describe('DELETE /posts/:id', () => {
    let postToDeleteId: string;

    beforeEach(async () => {
      // Create a post to delete
      const createPostDto = {
        caption: 'Post to delete',
        imageUrl: 'https://example.com/delete-image.jpg',
      };

      const response = await request(app.getHttpServer())
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createPostDto)
        .expect(201);

      postToDeleteId = response.body.id;
    });

    it('should delete a post successfully', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/posts/${postToDeleteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Post deleted successfully',
      });

      // Verify post is deleted
      await request(app.getHttpServer())
        .get(`/posts/${postToDeleteId}`)
        .expect(404);
    });

    it('should fail to delete post without authentication', async () => {
      await request(app.getHttpServer())
        .delete(`/posts/${postToDeleteId}`)
        .expect(401);
    });

    it('should return 404 for non-existent post', async () => {
      await request(app.getHttpServer())
        .delete('/api/posts/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should fail to delete another user\'s post', async () => {
      // Create another user
      const anotherUser = {
        username: 'anotheruser',
        email: 'another@example.com',
        fullName: 'Another User',
        password: 'TestPassword123!',
      };

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(anotherUser)
        .expect(201);

      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: anotherUser.email,
          password: anotherUser.password,
        })
        .expect(200);

      const anotherUserToken = loginResponse.body.accessToken;

      // Try to delete original user's post
      await request(app.getHttpServer())
        .delete(`/posts/${postToDeleteId}`)
        .set('Authorization', `Bearer ${anotherUserToken}`)
        .expect(403);
    });
  });
});