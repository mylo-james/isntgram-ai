import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AuthModule } from '../src/auth/auth.module';
import { User } from '../src/users/entities/user.entity';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ConfigModule } from '@nestjs/config';

describe('Auth Integration Tests', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;

  beforeAll(async () => {
    // Use SQLite for testing by default, PostgreSQL only when DATABASE_URL is explicitly set
    const usePostgres =
      process.env.DATABASE_URL && process.env.NODE_ENV !== 'test';
    const databaseConfig = usePostgres
      ? {
          type: 'postgres' as const,
          url: process.env.DATABASE_URL,
          entities: [User],
          synchronize: true,
          logging: false,
        }
      : {
          type: 'sqlite' as const,
          database: ':memory:',
          entities: [User],
          synchronize: true,
          logging: false,
        };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot(databaseConfig),
        // Disable throttling for tests
        ThrottlerModule.forRoot([
          {
            ttl: 60000,
            limit: 1000, // Very high limit for tests
          },
        ]),
        AuthModule,
      ],
      providers: [
        {
          provide: 'DATABASE_URL',
          useValue: process.env.DATABASE_URL || 'sqlite://:memory:',
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Match production global prefix
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();

    // Get repository for cleanup
    userRepository = moduleFixture.get<Repository<User>>(
      getRepositoryToken(User),
    );
  }, 30000); // Increase timeout to 30 seconds

  beforeEach(async () => {
    // Clean up database before each test
    await userRepository.clear();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('POST /api/auth/register', () => {
    const validUserData = {
      email: 'test@example.com',
      username: 'testuser',
      fullName: 'Test User',
      password: 'Password123',
    };

    it('should register a new user successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(validUserData)
        .expect(201);

      expect(response.body).toHaveProperty(
        'message',
        'User registered successfully',
      );
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email', validUserData.email);
      expect(response.body.user).toHaveProperty(
        'username',
        validUserData.username,
      );
      expect(response.body.user).toHaveProperty(
        'fullName',
        validUserData.fullName,
      );
      expect(response.body.user).not.toHaveProperty('hashedPassword');
    });

    it('should return 400 for invalid email format', async () => {
      const invalidData = {
        ...validUserData,
        email: 'invalid-email',
      };

      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      // Handle both string and array error messages
      const message = Array.isArray(response.body.message)
        ? response.body.message[0]
        : response.body.message;
      expect(message).toContain('valid email address');
    });

    it('should return 400 for weak password', async () => {
      const invalidData = {
        ...validUserData,
        password: 'weak',
      };

      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      // Handle both string and array error messages
      const message = Array.isArray(response.body.message)
        ? response.body.message[0]
        : response.body.message;
      expect(message).toContain('Password must contain');
    });

    it('should return 400 for short username', async () => {
      const invalidData = {
        ...validUserData,
        username: 'ab',
      };

      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      // Handle both string and array error messages
      const message = Array.isArray(response.body.message)
        ? response.body.message[0]
        : response.body.message;
      expect(message).toContain('at least 3 characters');
    });

    it('should return 409 for duplicate email', async () => {
      // Register first user
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(validUserData)
        .expect(201);

      // Try to register with same email
      const duplicateData = {
        ...validUserData,
        username: 'differentuser',
      };

      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(duplicateData)
        .expect(409);

      expect(response.body).toHaveProperty(
        'message',
        'Email already registered',
      );
    });

    it('should return 409 for duplicate username', async () => {
      // Register first user
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(validUserData)
        .expect(201);

      // Try to register with same username
      const duplicateData = {
        ...validUserData,
        email: 'different@example.com',
      };

      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(duplicateData)
        .expect(409);

      expect(response.body).toHaveProperty('message', 'Username already taken');
    });
  });

  describe('POST /api/auth/signin', () => {
    const userData = {
      email: 'signin@example.com',
      username: 'signinuser',
      fullName: 'Sign In User',
      password: 'Password123',
    };

    beforeEach(async () => {
      // Register a user for signin tests
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(userData)
        .expect(201);
    });

    it('should sign in user successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/signin')
        .send({
          email: userData.email,
          password: userData.password,
        })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Sign in successful');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', userData.email);
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('should return 401 for invalid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/signin')
        .send({
          email: userData.email,
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body).toHaveProperty('message', 'Invalid credentials');
    });

    it('should return 401 for non-existent user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/signin')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
        .expect(401);

      expect(response.body).toHaveProperty('message', 'Invalid credentials');
    });
  });

  describe('POST /api/auth/signout', () => {
    it('should sign out user successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/signout')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Sign out successful');
    });
  });
});
