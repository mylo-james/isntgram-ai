import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';

// Mock argon2 module
jest.mock('argon2', () => ({
  hash: jest.fn(),
  verify: jest.fn(),
  argon2id: 2,
}));

import * as argon2 from 'argon2';

describe('AuthService', () => {
  let service: AuthService;

  const mockUserRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
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

    const mockUser: User = {
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

    it('should register a new user successfully', async () => {
      // Mock repository methods
      mockUserRepository.findOne.mockResolvedValue(null); // No existing user
      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);

      // Mock argon2 hash
      (argon2.hash as jest.Mock).mockResolvedValue('hashedpassword');

      const result = await service.register(registerDto);

      expect(mockUserRepository.findOne).toHaveBeenCalledTimes(2);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { username: 'testuser' },
      });
      expect(argon2.hash).toHaveBeenCalled();
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        username: 'testuser',
        fullName: 'Test User',
        hashedPassword: 'hashedpassword',
        postsCount: 0,
        followerCount: 0,
        followingCount: 0,
      });
      expect(mockUserRepository.save).toHaveBeenCalledWith(mockUser);

      // Verify result doesn't include hashedPassword
      expect(result).not.toHaveProperty('hashedPassword');
      expect(result).toHaveProperty('id', 'test-uuid');
      expect(result).toHaveProperty('email', 'test@example.com');
    });

    it('should throw ConflictException when email already exists', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser); // Existing user

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.register(registerDto)).rejects.toThrow(
        'Email already registered',
      );

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when username already exists', async () => {
      // Mock the repository to return null for email check, but user for username check
      mockUserRepository.findOne
        .mockResolvedValueOnce(null) // No email conflict
        .mockResolvedValueOnce({ ...mockUser, username: 'existinguser' }); // Username conflict

      // Mock argon2 hash
      (argon2.hash as jest.Mock).mockResolvedValue('hashedpassword');

      await expect(service.register(registerDto)).rejects.toThrow(
        'Username already taken',
      );

      expect(mockUserRepository.findOne).toHaveBeenCalledTimes(2);
    });
  });

  describe('validateUser', () => {
    const mockUser: User = {
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

    it('should return user when credentials are valid', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'password');

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(argon2.verify).toHaveBeenCalledWith('hashedpassword', 'password');
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.validateUser('test@example.com', 'password');

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(result).toBeNull();
    });

    it('should return null when password is incorrect', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser(
        'test@example.com',
        'wrongpassword',
      );

      expect(argon2.verify).toHaveBeenCalledWith(
        'hashedpassword',
        'wrongpassword',
      );
      expect(result).toBeNull();
    });
  });

  describe('findUserById', () => {
    it('should return user when found', async () => {
      const mockUser = { id: 'test-uuid', email: 'test@example.com' } as User;
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findUserById('test-uuid');

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'test-uuid' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.findUserById('test-uuid');

      expect(result).toBeNull();
    });
  });

  describe('findUserByEmail', () => {
    it('should return user when found', async () => {
      const mockUser = { id: 'test-uuid', email: 'test@example.com' } as User;
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findUserByEmail('test@example.com');

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.findUserByEmail('test@example.com');

      expect(result).toBeNull();
    });
  });
});
