import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import argon2 from 'argon2';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

jest.mock('argon2');

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: Repository<User>;
  let jwtService: JwtService;

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
      });
    });
  });
});
