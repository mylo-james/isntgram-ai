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
import { Follow } from '../src/follows/entities/follow.entity';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ConfigModule } from '@nestjs/config';

describe('Follows Integration Tests', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let followRepository: Repository<Follow>;

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

    userRepository = moduleFixture.get<Repository<User>>(
      getRepositoryToken(User),
    );
    followRepository = moduleFixture.get<Repository<Follow>>(
      getRepositoryToken(Follow),
    );
  });

  beforeEach(async () => {
    await followRepository.clear();
    await userRepository.clear();
  });

  afterAll(async () => {
    await app.close();
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

    const statusAfter = await request(app.getHttpServer())
      .get('/api/follows/userb/status')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(statusAfter.body).toEqual({ isFollowing: true });

    const unfollowRes = await request(app.getHttpServer())
      .delete('/api/follows/userb')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(unfollowRes.body).toEqual({ isFollowing: false });

    const statusAfterUnfollow = await request(app.getHttpServer())
      .get('/api/follows/userb/status')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(statusAfterUnfollow.body).toEqual({ isFollowing: false });
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
