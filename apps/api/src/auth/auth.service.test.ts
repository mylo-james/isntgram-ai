import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { ConflictException } from '@nestjs/common';
import argon2 from 'argon2';
import { ConfigModule } from '@nestjs/config';

jest.mock('argon2');

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: Repository<User>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: false })],
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            create: jest.fn((data) => ({ ...data })),
            save: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should throw ConflictException if email already exists', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValueOnce({} as User);

      await expect(
        service.register({
          email: 'test@example.com',
          username: 'test',
          fullName: 'Test',
          password: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should throw ConflictException if username already exists', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValueOnce(
        null as unknown as User,
      );
      (userRepository.findOne as jest.Mock).mockResolvedValueOnce({} as User);

      await expect(
        service.register({
          email: 'test2@example.com',
          username: 'test',
          fullName: 'Test',
          password: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should create a new user when no conflicts', async () => {
      (argon2.hash as jest.Mock).mockResolvedValue('hashed');
      (userRepository.findOne as jest.Mock).mockResolvedValueOnce(
        null as unknown as User,
      );
      (userRepository.findOne as jest.Mock).mockResolvedValueOnce(
        null as unknown as User,
      );

      (userRepository.save as jest.Mock).mockResolvedValueOnce({
        id: '1',
        email: 'ok@example.com',
        username: 'ok',
        fullName: 'Ok',
        hashedPassword: 'hashed',
        postsCount: 0,
        followerCount: 0,
        followingCount: 0,
      } as unknown as User);

      const created = await service.register({
        email: 'ok@example.com',
        username: 'ok',
        fullName: 'Ok',
        password: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
      });

      expect(userRepository.save).toHaveBeenCalled();
      expect(created).toHaveProperty('email', 'ok@example.com');
      expect((created as unknown as User).hashedPassword).toBeUndefined();
    });
  });

  describe('validateUser', () => {
    it('should return user when credentials are valid', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        hashedPassword: 'hashedPassword',
      } as User;

      (userRepository.findOne as jest.Mock).mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'password');

      expect(result).toEqual(mockUser);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(argon2.verify).toHaveBeenCalledWith('hashedPassword', 'password');
    });

    it('should return null when user does not exist', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValue(null);

      const result = await service.validateUser('test@example.com', 'password');

      expect(result).toBeNull();
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null when password is invalid', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        hashedPassword: 'hashedPassword',
      } as User;

      (userRepository.findOne as jest.Mock).mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser('test@example.com', 'wrongpassword');

      expect(result).toBeNull();
      expect(argon2.verify).toHaveBeenCalledWith('hashedPassword', 'wrongpassword');
    });
  });

  describe('findUserById', () => {
    it('should return user when found', async () => {
      const mockUser = { id: '1', email: 'test@example.com' } as User;
      (userRepository.findOne as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findUserById('1');

      expect(result).toEqual(mockUser);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should return null when user not found', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValue(null);

      const result = await service.findUserById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findUserByEmail', () => {
    it('should return user when found', async () => {
      const mockUser = { id: '1', email: 'test@example.com' } as User;
      (userRepository.findOne as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findUserByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null when user not found', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValue(null);

      const result = await service.findUserByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('getOrCreateDemoUser', () => {
    it('should return existing demo user when found', async () => {
      const mockDemoUser = {
        id: '1',
        email: 'demo@isntgram.ai',
        username: 'demo',
        fullName: 'Demo User',
        hashedPassword: 'hashedPassword',
      } as User;

      (userRepository.findOne as jest.Mock).mockResolvedValue(mockDemoUser);

      const result = await service.getOrCreateDemoUser();

      expect(result).toEqual({
        id: '1',
        email: 'demo@isntgram.ai',
        username: 'demo',
        fullName: 'Demo User',
      });
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'demo@isntgram.ai' },
      });
    });

    it('should create new demo user when not found', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValue(null);
      (argon2.hash as jest.Mock).mockResolvedValue('hashedDemoPassword');

      const mockCreatedUser = {
        id: '1',
        email: 'demo@isntgram.ai',
        username: 'demo',
        fullName: 'Demo User',
        hashedPassword: 'hashedDemoPassword',
        postsCount: 3,
        followerCount: 12,
        followingCount: 7,
      } as User;

      (userRepository.save as jest.Mock).mockResolvedValue(mockCreatedUser);

      const result = await service.getOrCreateDemoUser();

      expect(result).toEqual({
        id: '1',
        email: 'demo@isntgram.ai',
        username: 'demo',
        fullName: 'Demo User',
        postsCount: 3,
        followerCount: 12,
        followingCount: 7,
      });
      expect(userRepository.create).toHaveBeenCalledWith({
        email: 'demo@isntgram.ai',
        username: 'demo',
        fullName: 'Demo User',
        hashedPassword: 'hashedDemoPassword',
        postsCount: 3,
        followerCount: 12,
        followingCount: 7,
      });
      expect(userRepository.save).toHaveBeenCalled();
    });
  });
});
