import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { UsersModule } from '../src/users/users.module';
import { AuthModule } from '../src/auth/auth.module';
import { FollowsModule } from '../src/follows/follows.module';
import { User } from '../src/users/entities/user.entity';
import { Follows } from '../src/follows/entities/follows.entity';
import { Post as PostEntity } from '../src/posts/entities/post.entity';
import { PostLike } from '../src/likes/entities/post-like.entity';
import { Comment } from '../src/comments/entities/comment.entity';
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

describe('Follows Integration Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [User, Follows, PostEntity, PostLike, Comment],
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
        FollowsModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should follow and unfollow a user', async () => {
    const tokenA = await registerAndLogin(app, {
      email: 'a@example.com',
      username: 'usera',
      fullName: 'User A',
      password: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
    });
    const tokenB = await registerAndLogin(app, {
      email: 'b@example.com',
      username: 'userb',
      fullName: 'User B',
      password: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
    });

    await request(app.getHttpServer())
      .post('/api/users/userb/follow')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(204);

    const statusAfterFollow = await request(app.getHttpServer())
      .get('/api/users/userb/is-following')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(statusAfterFollow.body).toEqual({ isFollowing: true });

    await request(app.getHttpServer())
      .delete('/api/users/userb/follow')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(204);

    const statusAfterUnfollow = await request(app.getHttpServer())
      .get('/api/users/userb/is-following')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(statusAfterUnfollow.body).toEqual({ isFollowing: false });

    // Optional auth follower/following lists should still work for authenticated viewers.
    const followers = await request(app.getHttpServer())
      .get('/api/users/userb/followers')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(followers.body).toHaveProperty('users');

    const following = await request(app.getHttpServer())
      .get('/api/users/usera/following')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(following.body).toHaveProperty('users');
  });

  it('returns viewer-relative isFollowing in followers/following lists', async () => {
    const tokenA = await registerAndLogin(app, {
      email: 'rel-a@example.com',
      username: 'rela',
      fullName: 'Rel A',
      password: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
    });
    await registerAndLogin(app, {
      email: 'rel-b@example.com',
      username: 'relb',
      fullName: 'Rel B',
      password: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
    });
    const tokenC = await registerAndLogin(app, {
      email: 'rel-c@example.com',
      username: 'relc',
      fullName: 'Rel C',
      password: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
    });

    // A follows B (so A appears in B's followers list)
    await request(app.getHttpServer())
      .post('/api/users/relb/follow')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(204);

    // C follows A (so in B's followers list, viewer C is following follower A)
    await request(app.getHttpServer())
      .post('/api/users/rela/follow')
      .set('Authorization', `Bearer ${tokenC}`)
      .expect(204);

    // C follows B (so in A's following list, viewer C is following user B)
    await request(app.getHttpServer())
      .post('/api/users/relb/follow')
      .set('Authorization', `Bearer ${tokenC}`)
      .expect(204);

    const followers = await request(app.getHttpServer())
      .get('/api/users/relb/followers')
      .set('Authorization', `Bearer ${tokenC}`)
      .expect(200);

    const followerA = (
      followers.body.users as Array<{ username: string; isFollowing: boolean }>
    ).find((u) => u.username === 'rela');
    expect(followerA).toBeDefined();
    expect(followerA?.isFollowing).toBe(true);

    const following = await request(app.getHttpServer())
      .get('/api/users/rela/following')
      .set('Authorization', `Bearer ${tokenC}`)
      .expect(200);

    const followingB = (
      following.body.users as Array<{ username: string; isFollowing: boolean }>
    ).find((u) => u.username === 'relb');
    expect(followingB).toBeDefined();
    expect(followingB?.isFollowing).toBe(true);
  });
});
