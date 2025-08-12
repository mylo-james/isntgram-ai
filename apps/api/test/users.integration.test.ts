import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { UsersModule } from '../src/users/users.module';
import { AuthModule } from '../src/auth/auth.module';
import { User } from '../src/users/entities/user.entity';
import { Follows } from '../src/follows/entities/follows.entity';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ConfigModule } from '@nestjs/config';

describe('Users Integration Tests', () => {
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

  it('should check username availability and update profile', async () => {
    // Create a user via register
    const registerResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'user@example.com',
        username: 'user1',
        fullName: 'User One',
        password: 'Password123',
      })
      .expect(201);

    const userId = registerResponse.body.user.id as string;

    // Check username availability
    const checkRes = await request(app.getHttpServer())
      .get('/api/users/check-username/user2')
      .expect(200);
    expect(checkRes.body).toEqual({ available: true });

    // Update profile
    const updateRes = await request(app.getHttpServer())
      .put('/api/users/profile')
      .send({ id: userId, fullName: 'New Name', username: 'user2' })
      .expect(200);

    expect(updateRes.body).toHaveProperty('username', 'user2');
    expect(updateRes.body).toHaveProperty('fullName', 'New Name');
  });
});
