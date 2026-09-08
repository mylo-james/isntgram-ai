import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { ForbiddenException } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { DemoService } from './demo/demo.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    revokeUserTokens: jest.fn(),
  };

  const mockDemoService = {
    createDemoSession: jest.fn(),
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
          provide: DemoService,
          useValue: mockDemoService,
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

    it('discloses demo fields only for a demo login', async () => {
      mockAuthService.login.mockResolvedValue({
        user: { id: 'demo' },
        accessToken: 'jwt',
        isDemoUser: true,
        demoExpiresAt: '2026-01-01T00:00:00.000Z',
      });
      await expect(
        controller.login({
          email: 'demo@example.com',
          password: 'Password123',
        }),
      ).resolves.toEqual({
        message: 'Login successful',
        user: { id: 'demo' },
        accessToken: 'jwt',
        isDemoUser: true,
        demoExpiresAt: '2026-01-01T00:00:00.000Z',
      });
    });
  });

  it('revokes only the authenticated user token version on logout', async () => {
    await expect(
      controller.logout({ user: { userId: 'user-1' } } as never),
    ).resolves.toEqual({ message: 'Logged out' });
    expect(mockAuthService.revokeUserTokens).toHaveBeenCalledWith('user-1');
  });

  describe('demo', () => {
    it('throws ForbiddenException when demo mode is disabled', async () => {
      mockDemoService.createDemoSession.mockRejectedValue(
        new ForbiddenException('Demo mode disabled'),
      );

      await expect(controller.demo()).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(mockDemoService.createDemoSession).toHaveBeenCalledTimes(1);
    });

    it('signs in a demo user and returns an access token', async () => {
      mockDemoService.createDemoSession.mockResolvedValue({
        user: {
          id: 'demo',
          email: 'demo_abc123@demo.isntgram.local',
          username: 'demo_abc123',
          fullName: 'Demo abc123',
        },
        accessToken: 'jwt-token',
        isDemoUser: true,
        demoExpiresAt: '2025-12-23T00:00:00.000Z',
      });

      const result = await controller.demo();

      expect(mockDemoService.createDemoSession).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        message: 'Demo sign in successful',
        user: {
          id: 'demo',
          email: 'demo_abc123@demo.isntgram.local',
          username: 'demo_abc123',
          fullName: 'Demo abc123',
        },
        accessToken: 'jwt-token',
        isDemoUser: true,
        demoExpiresAt: '2025-12-23T00:00:00.000Z',
      });
    });
  });
});
