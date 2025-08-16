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
          entities: [User, Follows],
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
    await registerAndLogin(app, {
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
  });
});
