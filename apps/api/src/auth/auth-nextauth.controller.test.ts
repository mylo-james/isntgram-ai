import { Test, TestingModule } from '@nestjs/testing';
import { AuthNextAuthController } from './auth-nextauth.controller';
import { AuthService } from './auth.service';
import { Response } from 'express';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';

describe('AuthNextAuthController', () => {
  let controller: AuthNextAuthController;
  let authService: AuthService;

  const mockAuthService = {
    validateUser: jest.fn(),
    register: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('test-token'),
  } as unknown as JwtService;

  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
  } as unknown as Response;

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

      await controller.signIn(credentials, mockResponse);

      expect(authService.validateUser).toHaveBeenCalledWith(
        credentials.email,
        credentials.password,
      );
      expect(mockResponse.cookie).not.toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
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

      await controller.signIn(credentials, mockResponse);

      expect(authService.validateUser).toHaveBeenCalledWith(
        credentials.email,
        credentials.password,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Invalid credentials',
      });
    });
  });

  describe('signOut', () => {
    it('should clear session cookie and return success message', async () => {
      await controller.signOut(mockResponse);

      expect(mockResponse.clearCookie).not.toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Sign out successful',
      });
    });
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      username: 'testuser',
      fullName: 'Test User',
      password: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
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

    it('should register user and create session', async () => {
      mockAuthService.register.mockResolvedValue(mockUser);

      await controller.register(registerDto, mockResponse);

      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(mockResponse.cookie).not.toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'User registered successfully',
        user: mockUser,
      });
    });
  });
});
