import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;

  const mockUser = {
    id: '1',
    email: 'test@example.com',
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    passwordHash: 'hashedPassword',
    avatarUrl: null,
    bio: null,
    isVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUsersService = {
    create: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
    validatePassword: jest.fn(),
    createPasswordResetToken: jest.fn(),
    resetPassword: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const registerDto: RegisterDto = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'Password123',
        firstName: 'Test',
        lastName: 'User',
      };

      const mockJwtPayload = { sub: mockUser.id, email: mockUser.email };
      const mockAccessToken = 'access-token';
      const mockRefreshToken = 'refresh-token';

      mockUsersService.create.mockResolvedValue(mockUser);
      mockJwtService.sign
        .mockReturnValueOnce(mockAccessToken)
        .mockReturnValueOnce(mockRefreshToken);

      const result = await service.register(registerDto);

      expect(usersService.create).toHaveBeenCalledWith(registerDto);
      expect(jwtService.sign).toHaveBeenCalledWith(mockJwtPayload);
      expect(jwtService.sign).toHaveBeenCalledWith(mockJwtPayload, {
        expiresIn: '7d',
      });
      expect(result).toEqual({
        user: {
          id: mockUser.id,
          email: mockUser.email,
          username: mockUser.username,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          avatarUrl: mockUser.avatarUrl,
          bio: mockUser.bio,
          isVerified: mockUser.isVerified,
          createdAt: mockUser.createdAt,
        },
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
      });
    });
  });

  describe('login', () => {
    it('should login user with valid credentials', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'Password123',
      };

      const mockJwtPayload = { sub: mockUser.id, email: mockUser.email };
      const mockAccessToken = 'access-token';
      const mockRefreshToken = 'refresh-token';

      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      mockUsersService.validatePassword.mockResolvedValue(true);
      mockJwtService.sign
        .mockReturnValueOnce(mockAccessToken)
        .mockReturnValueOnce(mockRefreshToken);

      const result = await service.login(loginDto);

      expect(usersService.findByEmail).toHaveBeenCalledWith(loginDto.email);
      expect(usersService.validatePassword).toHaveBeenCalledWith(
        mockUser,
        loginDto.password,
      );
      expect(jwtService.sign).toHaveBeenCalledWith(mockJwtPayload);
      expect(jwtService.sign).toHaveBeenCalledWith(mockJwtPayload, {
        expiresIn: '7d',
      });
      expect(result).toEqual({
        user: {
          id: mockUser.id,
          email: mockUser.email,
          username: mockUser.username,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          avatarUrl: mockUser.avatarUrl,
          bio: mockUser.bio,
          isVerified: mockUser.isVerified,
          createdAt: mockUser.createdAt,
        },
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
      });
    });

    it('should throw UnauthorizedException for invalid email', async () => {
      const loginDto: LoginDto = {
        email: 'nonexistent@example.com',
        password: 'Password123',
      };

      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(usersService.findByEmail).toHaveBeenCalledWith(loginDto.email);
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'WrongPassword123',
      };

      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      mockUsersService.validatePassword.mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(usersService.findByEmail).toHaveBeenCalledWith(loginDto.email);
      expect(usersService.validatePassword).toHaveBeenCalledWith(
        mockUser,
        loginDto.password,
      );
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const userId = '1';
      const mockJwtPayload = { sub: mockUser.id, email: mockUser.email };
      const mockAccessToken = 'new-access-token';

      mockUsersService.findById.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue(mockAccessToken);

      const result = await service.refreshToken(userId);

      expect(usersService.findById).toHaveBeenCalledWith(userId);
      expect(jwtService.sign).toHaveBeenCalledWith(mockJwtPayload);
      expect(result).toEqual({
        accessToken: mockAccessToken,
      });
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      const userId = '999';

      mockUsersService.findById.mockResolvedValue(null);

      await expect(service.refreshToken(userId)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(usersService.findById).toHaveBeenCalledWith(userId);
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const userId = '1';

      mockUsersService.findById.mockResolvedValue(mockUser);

      const result = await service.getProfile(userId);

      expect(usersService.findById).toHaveBeenCalledWith(userId);
      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        username: mockUser.username,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        avatarUrl: mockUser.avatarUrl,
        bio: mockUser.bio,
        isVerified: mockUser.isVerified,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      const userId = '999';

      mockUsersService.findById.mockResolvedValue(null);

      await expect(service.getProfile(userId)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(usersService.findById).toHaveBeenCalledWith(userId);
    });
  });
});
