import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AuthModule } from '../src/auth/auth.module';
import { FollowsModule } from '../src/follows/follows.module';
import { User } from '../src/users/entities/user.entity';
import { Post } from '../src/posts/entities/post.entity';
import { Like } from '../src/posts/entities/like.entity';
import { Comment } from '../src/posts/entities/comment.entity';
import { Follow } from '../src/follows/entities/follow.entity';
import { Notification } from '../src/notifications/entities/notification.entity';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ConfigModule } from '@nestjs/config';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { selectTestDatabase } = require('./test-database-target.cjs') as {
  selectTestDatabase: (
    env: NodeJS.ProcessEnv,
  ) => { kind: 'sqlite' } | { kind: 'postgres'; url: string };
};

describe('Follows Integration Tests', () => {
  let app: INestApplication;
  let isPostgres = false;
  let userRepository: Repository<User>;
  let followRepository: Repository<Follow>;
  let notificationRepository: Repository<Notification>;

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
          entities: [User, Post, Like, Comment, Follow, Notification],
          synchronize: true,
        }),
        ThrottlerModule.forRoot([
          {
            ttl: 60000,
            limit: 1000,
          },
        ]),
        AuthModule,
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
    // Keep one loopback listener for the suite; Supertest must not close it per request.
    await app.listen(0, '127.0.0.1');

    userRepository = moduleFixture.get<Repository<User>>(
      getRepositoryToken(User),
    );
    followRepository = moduleFixture.get<Repository<Follow>>(
      getRepositoryToken(Follow),
    );
    notificationRepository = moduleFixture.get<Repository<Notification>>(
      getRepositoryToken(Notification),
    );
  });

  beforeEach(async () => {
    if (isPostgres) {
      await userRepository.query('TRUNCATE TABLE "users" CASCADE');
      return;
    }
    await notificationRepository.clear();
    await followRepository.clear();
    await userRepository.clear();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('requires auth for follow status', async () => {
    await request(app.getHttpServer())
      .get('/api/follows/someone/status')
      .expect(401);
  });

  it('follow status + follow + unfollow round-trip', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'a@example.com',
        username: 'usera',
        fullName: 'User A',
        password: 'Password123',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'b@example.com',
        username: 'userb',
        fullName: 'User B',
        password: 'Password123',
      })
      .expect(201);

    const aLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'a@example.com', password: 'Password123' })
      .expect(200);

    const tokenA = aLogin.body.accessToken as string;

    const statusBefore = await request(app.getHttpServer())
      .get('/api/follows/userb/status')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(statusBefore.body).toEqual({ isFollowing: false });

    const followRes = await request(app.getHttpServer())
      .post('/api/follows/userb')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(201);
    expect(followRes.body).toEqual({ isFollowing: true });

    const [followingUser, followedUser] = await Promise.all([
      userRepository.findOneByOrFail({ username: 'usera' }),
      userRepository.findOneByOrFail({ username: 'userb' }),
    ]);
    expect(followingUser.followingCount).toBe(1);
    expect(followedUser.followerCount).toBe(1);
    const firstFollow = await followRepository.findOneByOrFail({
      followerId: followingUser.id,
      followingId: followedUser.id,
    });
    await expect(
      notificationRepository.findOneByOrFail({
        type: 'follow',
        sourceId: firstFollow.id,
      }),
    ).resolves.toMatchObject({
      recipientId: followedUser.id,
      actorId: followingUser.id,
      postId: null,
      commentId: null,
    });

    const statusAfter = await request(app.getHttpServer())
      .get('/api/follows/userb/status')
      .set('Authorization', `Bearer ${tokenA}`);
    expect({ status: statusAfter.status, body: statusAfter.body }).toEqual({
      status: 200,
      body: { isFollowing: true },
    });

    const unfollowRes = await request(app.getHttpServer())
      .delete('/api/follows/userb')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(unfollowRes.body).toEqual({ isFollowing: false });

    const [unfollowedUser, formerTarget] = await Promise.all([
      userRepository.findOneByOrFail({ username: 'usera' }),
      userRepository.findOneByOrFail({ username: 'userb' }),
    ]);
    expect(unfollowedUser.followingCount).toBe(0);
    expect(formerTarget.followerCount).toBe(0);
    expect(await notificationRepository.count()).toBe(1);

    const statusAfterUnfollow = await request(app.getHttpServer())
      .get('/api/follows/userb/status')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(statusAfterUnfollow.body).toEqual({ isFollowing: false });

    await request(app.getHttpServer())
      .post('/api/follows/userb')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(201);

    expect(await notificationRepository.count()).toBe(2);
  });

  it('rejects following yourself', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'a@example.com',
        username: 'usera',
        fullName: 'User A',
        password: 'Password123',
      })
      .expect(201);

    const aLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'a@example.com', password: 'Password123' })
      .expect(200);

    const tokenA = aLogin.body.accessToken as string;

    await request(app.getHttpServer())
      .post('/api/follows/usera')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(400);
  });

  it('returns 404 when target user does not exist', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'a@example.com',
        username: 'usera',
        fullName: 'User A',
        password: 'Password123',
      })
      .expect(201);

    const aLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'a@example.com', password: 'Password123' })
      .expect(200);

    const tokenA = aLogin.body.accessToken as string;

    await request(app.getHttpServer())
      .post('/api/follows/missing')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);

    await request(app.getHttpServer())
      .get('/api/follows/missing/status')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);

    await request(app.getHttpServer())
      .delete('/api/follows/missing')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);
  });
});
