import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { ForbiddenException } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let configService: { get: jest.Mock };

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    getOrCreateDemoUser: jest.fn(),
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
    configService = module.get(ConfigService) as unknown as { get: jest.Mock };
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

  describe('demo', () => {
    it('throws ForbiddenException when demo mode is disabled', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'DEMO_ENABLED') return 'false';
        return undefined;
      });

      await expect(controller.demo()).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(mockAuthService.getOrCreateDemoUser).not.toHaveBeenCalled();
      expect(mockAuthService.login).not.toHaveBeenCalled();
    });

    it('signs in a demo user using the default demo password', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'DEMO_ENABLED') return 'true';
        if (key === 'DEMO_PASSWORD') return undefined;
        return undefined;
      });

      mockAuthService.getOrCreateDemoUser.mockResolvedValue({
        email: 'demo@isntgram.ai',
      });
      mockAuthService.login.mockResolvedValue({
        user: {
          id: 'demo',
          email: 'demo@isntgram.ai',
          username: 'demo',
          fullName: 'Demo User',
        },
        accessToken: 'jwt-token',
      });

      const result = await controller.demo();

      expect(mockAuthService.getOrCreateDemoUser).toHaveBeenCalledTimes(1);
      expect(mockAuthService.login).toHaveBeenCalledWith(
        'demo@isntgram.ai',
        'demo',
      );
      expect(result).toEqual({
        message: 'Demo sign in successful',
        user: {
          id: 'demo',
          email: 'demo@isntgram.ai',
          username: 'demo',
          fullName: 'Demo User',
        },
        accessToken: 'jwt-token',
        isDemoUser: true,
      });
    });

    it('signs in a demo user using the configured demo password', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'DEMO_ENABLED') return 'true';
        if (key === 'DEMO_PASSWORD') return 'supersecret';
        return undefined;
      });

      mockAuthService.getOrCreateDemoUser.mockResolvedValue({
        email: 'demo@isntgram.ai',
      });
      mockAuthService.login.mockResolvedValue({
        user: {
          id: 'demo',
          email: 'demo@isntgram.ai',
          username: 'demo',
          fullName: 'Demo User',
        },
        accessToken: 'jwt-token',
      });

      await controller.demo();

      expect(mockAuthService.login).toHaveBeenCalledWith(
        'demo@isntgram.ai',
        'supersecret',
      );
    });
  });
});
