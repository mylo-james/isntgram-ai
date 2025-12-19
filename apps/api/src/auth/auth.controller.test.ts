import request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '../auth/auth.module';
import { User } from '../users/entities/user.entity';
import { Post } from '../posts/entities/post.entity';
import { Follow } from '../follows/entities/follow.entity';
import { GlobalExceptionFilter } from '../common/filters/global-exception.filter';
import { ConfigModule, ConfigService } from '@nestjs/config';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          {
            ttl: 60000,
            limit: 10,
          },
        ]),
      ],
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'test@example.com',
      username: 'testuser',
      fullName: 'Test User',
      password: 'Password123',
    };

    const mockUser = {
      id: 'test-uuid',
      email: 'test@example.com',
      username: 'testuser',
      fullName: 'Test User',
      postsCount: 0,
      followerCount: 0,
      followingCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should register a new user successfully', async () => {
      mockAuthService.register.mockResolvedValue(mockUser);

      const result = await controller.register(registerDto);

      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(result).toEqual({
        message: 'User registered successfully',
        user: mockUser,
      });
    });

    it('should handle service errors properly', async () => {
      const error = new Error('Registration failed');
      mockAuthService.register.mockRejectedValue(error);

      await expect(controller.register(registerDto)).rejects.toThrow(error);
      expect(authService.register).toHaveBeenCalledWith(registerDto);
    });
  });

  describe('login', () => {
    it('should return access token and user', async () => {
      const loginResult = {
        user: {
          id: 'test-uuid',
          email: 'test@example.com',
          username: 'testuser',
          fullName: 'Test User',
        },
        accessToken: 'jwt-token',
      };

      mockAuthService.login.mockResolvedValue(loginResult);

      const result = await controller.login({
        email: 'test@example.com',
        password: 'Password123',
      });

      expect(result).toEqual({
        message: 'Login successful',
        user: loginResult.user,
        accessToken: loginResult.accessToken,
      });
    });
  });
});

describe('Auth demo endpoint (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.DEMO_ENABLED = 'true';
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
        ThrottlerModule.forRoot([{ ttl: 60000, limit: 1000 }]),
        AuthModule,
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

  it('POST /api/auth/demo returns a demo user and 200', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/demo')
      .send({});
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('email');
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('isDemoUser', true);
  });
});
