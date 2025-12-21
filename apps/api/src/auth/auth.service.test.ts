import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { Post } from '../posts/entities/post.entity';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

jest.mock('argon2');

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: Repository<User>;
  let jwtService: JwtService;
  let configService: ConfigService;
  let postRepository: {
    count: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let managedUserRepository: {
    update: jest.Mock;
  };

  beforeEach(async () => {
    postRepository = {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn(),
    };
    managedUserRepository = {
      update: jest.fn(),
    };

    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === Post) {
          return postRepository;
        }
        return managedUserRepository;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            create: jest.fn((data) => ({ ...data })),
            save: jest.fn(),
            findOne: jest.fn(),
            increment: jest.fn(),
            manager,
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('jwt-token'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('register', () => {
    it('should throw ConflictException if email already exists', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValueOnce({} as User);

      await expect(
        service.register({
          email: 'test@example.com',
          username: 'test',
          fullName: 'Test',
          password: 'Password123!',
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
          password: 'Password123!',
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
        password: 'Password123!',
      });

      expect(userRepository.save).toHaveBeenCalled();
      expect(created).toHaveProperty('email', 'ok@example.com');
      expect((created as unknown as User).hashedPassword).toBeUndefined();
    });

    it('normalizes registration fields before saving', async () => {
      (argon2.hash as jest.Mock).mockResolvedValue('hashed');
      (userRepository.findOne as jest.Mock)
        .mockResolvedValueOnce(null as unknown as User)
        .mockResolvedValueOnce(null as unknown as User);

      (userRepository.save as jest.Mock).mockResolvedValueOnce({
        id: '1',
        email: 'normalized@example.com',
        username: 'normalized',
        fullName: 'Normalized Name',
        hashedPassword: 'hashed',
        postsCount: 0,
        followerCount: 0,
        followingCount: 0,
      } as unknown as User);

      await service.register({
        email: '  Normalized@Example.com ',
        username: '  NORMALIZED ',
        fullName: '  Normalized Name  ',
        password: 'Password123!',
      });

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'normalized@example.com',
          username: 'normalized',
          fullName: 'Normalized Name',
        }),
      );
    });

    it('throws ConflictException for unique constraint errors during save', async () => {
      (argon2.hash as jest.Mock).mockResolvedValue('hashed');
      (userRepository.findOne as jest.Mock)
        .mockResolvedValueOnce(null as unknown as User)
        .mockResolvedValueOnce(null as unknown as User);

      const driverError = new Error('duplicate') as Error & { code?: string };
      driverError.code = '23505';
      (userRepository.save as jest.Mock).mockRejectedValueOnce(
        new QueryFailedError('query', [], driverError),
      );

      await expect(
        service.register({
          email: 'ok@example.com',
          username: 'ok',
          fullName: 'Ok',
          password: 'Password123!',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException for invalid credentials', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValueOnce(null);
      await expect(
        service.login('bad@example.com', 'Password123!'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('should return access token and user for valid credentials', async () => {
      const mockUser = {
        id: '1',
        email: 'ok@example.com',
        username: 'ok',
        fullName: 'Ok',
        hashedPassword: 'hashed',
      } as unknown as User;

      (userRepository.findOne as jest.Mock).mockResolvedValueOnce(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await service.login('ok@example.com', 'Password123!');

      expect(result).toHaveProperty('accessToken', 'jwt-token');
      expect(result.user).toHaveProperty('email', 'ok@example.com');
      expect((result.user as unknown as User).hashedPassword).toBeUndefined();
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: '1',
        email: 'ok@example.com',
        username: 'ok',
        tokenVersion: 0,
      });
    });

    it('includes tokenVersion when present on the user', async () => {
      const mockUser = {
        id: '2',
        email: 'token@example.com',
        username: 'tokenuser',
        fullName: 'Token User',
        hashedPassword: 'hashed',
        tokenVersion: 3,
      } as unknown as User;

      (userRepository.findOne as jest.Mock).mockResolvedValueOnce(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await service.login('token@example.com', 'Password123!');

      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: '2',
        email: 'token@example.com',
        username: 'tokenuser',
        tokenVersion: 3,
      });
    });
  });

  describe('validateUser', () => {
    it('returns null when password verification fails', async () => {
      const user = {
        id: '1',
        email: 'ok@example.com',
        username: 'ok',
        fullName: 'Ok',
        hashedPassword: 'hashed',
      } as unknown as User;

      (userRepository.findOne as jest.Mock).mockResolvedValueOnce(user);
      (argon2.verify as jest.Mock).mockResolvedValueOnce(false);

      await expect(
        service.validateUser('ok@example.com', 'WrongPass123!'),
      ).resolves.toBeNull();
    });
  });

  describe('getOrCreateDemoUser', () => {
    it('returns existing demo user without hashedPassword', async () => {
      (configService.get as jest.Mock).mockReturnValue(undefined);
      const existingDemo = {
        id: 'demo-1',
        email: 'demo@isntgram.ai',
        username: 'demo',
        fullName: 'Demo User',
        hashedPassword: 'hashed',
        postsCount: 3,
        followerCount: 12,
        followingCount: 7,
      } as unknown as User;
      (userRepository.findOne as jest.Mock)
        .mockResolvedValueOnce(existingDemo)
        .mockResolvedValueOnce(existingDemo);
      postRepository.count.mockResolvedValueOnce(3);

      const result = await service.getOrCreateDemoUser();
      expect((result as any).hashedPassword).toBeUndefined();
      expect(result.email).toBe('demo@isntgram.ai');
    });

    it('creates demo user with defaults when missing', async () => {
      (configService.get as jest.Mock).mockReturnValue(undefined);
      (userRepository.findOne as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'demo-1',
          email: 'demo@isntgram.ai',
          username: 'demo',
          fullName: 'Demo User',
          hashedPassword: 'hashed-demo',
          postsCount: 3,
          followerCount: 12,
          followingCount: 7,
        } as unknown as User);
      (argon2.hash as jest.Mock).mockResolvedValueOnce('hashed-demo');
      (userRepository.create as jest.Mock).mockImplementation((data) => ({
        ...data,
      }));
      (userRepository.save as jest.Mock).mockResolvedValueOnce({
        id: 'demo-1',
        email: 'demo@isntgram.ai',
        username: 'demo',
        fullName: 'Demo User',
        hashedPassword: 'hashed-demo',
        postsCount: 0,
        followerCount: 12,
        followingCount: 7,
      } as unknown as User);

      const result = await service.getOrCreateDemoUser();

      expect(userRepository.save).toHaveBeenCalled();
      expect(result).toMatchObject({
        email: 'demo@isntgram.ai',
        username: 'demo',
        fullName: 'Demo User',
        postsCount: 3,
        followerCount: 12,
        followingCount: 7,
      });
      expect((result as any).hashedPassword).toBeUndefined();
    });
  });
});
