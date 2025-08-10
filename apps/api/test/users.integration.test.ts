import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { User } from '../src/users/entities/user.entity';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';

describe('Users Integration Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [User],
          synchronize: true,
          logging: false,
        }),
        ThrottlerModule.forRoot([{ ttl: 60000, limit: 1000 }]),
        AuthModule,
        UsersModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should check username availability and update profile', async () => {
    // Register a user first
    const registerRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'u@example.com',
        username: 'user1',
        fullName: 'User One',
        password: 'Password123',
      })
      .expect(201);

    const userId = registerRes.body.user.id as string;

    // Username availability (taken)
    const checkTaken = await request(app.getHttpServer())
      .get('/api/users/check-username/user1')
      .expect(200);
    expect(checkTaken.body).toEqual({ available: false });

    // Username availability (free)
    const checkFree = await request(app.getHttpServer())
      .get('/api/users/check-username/newuser')
      .expect(200);
    expect(checkFree.body).toEqual({ available: true });

    // Update profile
    const updateRes = await request(app.getHttpServer())
      .put('/api/users/profile')
      .send({ id: userId, fullName: 'User Uno', username: 'newuser' })
      .expect(200);

    expect(updateRes.body.username).toBe('newuser');
    expect(updateRes.body.fullName).toBe('User Uno');

    // Update with duplicate username should 409
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'v@example.com',
        username: 'user2',
        fullName: 'User Two',
        password: 'Password123',
      })
      .expect(201);

    await request(app.getHttpServer())
      .put('/api/users/profile')
      .send({ id: userId, fullName: 'User Uno', username: 'user2' })
      .expect(409);
  });
});
