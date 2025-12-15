import { Test, TestingModule } from '@nestjs/testing';
import { AuthNextAuthController } from './auth-nextauth.controller';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';

describe('AuthNextAuthController', () => {
  let controller: AuthNextAuthController;
  let authService: AuthService;

  const mockAuthService = {
    validateUser: jest.fn(),
    getOrCreateDemoUser: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('test-token'),
  } as unknown as JwtService;

  beforeEach(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [AuthNextAuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    });

    moduleBuilder
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) });

    const module: TestingModule = await moduleBuilder.compile();

    controller = module.get<AuthNextAuthController>(AuthNextAuthController);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('signIn', () => {
    const credentials = {
      email: 'test@example.com',
      password: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
    };

    const mockUser = {
      id: 'test-uuid',
      email: 'test@example.com',
      username: 'testuser',
      fullName: 'Test User',
      hashedPassword: 'hashedpassword',
      postsCount: 0,
      followerCount: 0,
      followingCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should sign in user successfully', async () => {
      mockAuthService.validateUser.mockResolvedValue(mockUser);

      const result = await controller.signIn(credentials);

      expect(authService.validateUser).toHaveBeenCalledWith(
        credentials.email,
        credentials.password,
      );
      expect(result).toEqual({
        message: 'Sign in successful',
        user: expect.objectContaining({
          id: 'test-uuid',
          email: 'test@example.com',
        }),
        accessToken: expect.any(String),
      });
    });

    it('should return 401 for invalid credentials', async () => {
      mockAuthService.validateUser.mockResolvedValue(null);

      await expect(controller.signIn(credentials)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(authService.validateUser).toHaveBeenCalledWith(
        credentials.email,
        credentials.password,
      );
    });
  });

  describe('signOut', () => {
    it('returns success message', async () => {
      await expect(controller.signOut()).resolves.toEqual({
        message: 'Sign out successful',
      });
    });
  });

  describe('demo', () => {
    it('returns demo user payload', async () => {
      const demoUser = {
        id: 'demo-id',
        email: 'demo@isntgram.ai',
        username: 'demo',
        fullName: 'Demo User',
      };
      mockAuthService.getOrCreateDemoUser.mockResolvedValue(demoUser);

      const result = await controller.demo();

      expect(authService.getOrCreateDemoUser).toHaveBeenCalled();
      expect(result).toEqual({
        message: 'Demo sign in successful',
        user: demoUser,
        isDemoUser: true,
      });
    });
  });
});
