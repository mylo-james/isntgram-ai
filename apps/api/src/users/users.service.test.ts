import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Follows } from '../follows/entities/follows.entity';

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: Repository<User>;

  const mockUser: User = {
    id: '1',
    username: 'testuser',
    fullName: 'Test User',
    email: 'test@example.com',
    hashedPassword: 'hashedpassword',
    profilePictureUrl: 'https://example.com/avatar.jpg',
    bio: 'Test bio',
    postsCount: 10,
    followerCount: 100,
    followingCount: 50,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
  } as User;

  const mockUserRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  } as unknown as jest.Mocked<Repository<User>>;
  const mockFollowsRepository = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
  } as unknown as jest.Mocked<Repository<Follows>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        {
          provide: getRepositoryToken(Follows),
          useValue: mockFollowsRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByUsername', () => {
    it('should return user when found', async () => {
      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findByUsername('testuser');

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { username: 'testuser' },
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findByUsername('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { username: 'nonexistent' },
      });
    });
  });

  describe('getUserProfile', () => {
    it('should return user profile DTO when user found', async () => {
      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.getUserProfile('testuser');

      expect(result).toEqual({
        id: mockUser.id,
        username: mockUser.username,
        fullName: mockUser.fullName,
        email: mockUser.email,
        profilePictureUrl: mockUser.profilePictureUrl,
        bio: mockUser.bio,
        postCount: mockUser.postsCount,
        followerCount: mockUser.followerCount,
        followingCount: mockUser.followingCount,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.getUserProfile('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findById', () => {
    it('should return user when found by ID', async () => {
      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findById('1');

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should throw NotFoundException when user not found by ID', async () => {
      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findById('999')).rejects.toThrow(NotFoundException);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: '999' },
      });
    });
  });

  describe('findByEmail', () => {
    it('should return user when found by email', async () => {
      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(mockUser);
      const result = await service.findByEmail('test@example.com');
      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should throw NotFoundException when user not found by email', async () => {
      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.findByEmail('none@example.com')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('isUsernameTaken', () => {
    it('returns true when username belongs to another user', async () => {
      (mockUserRepository.findOne as jest.Mock).mockResolvedValue({
        ...mockUser,
        id: '2',
      });
      await expect(service.isUsernameTaken('testuser', '1')).resolves.toBe(
        true,
      );
    });

    it('returns false when username matches same user (excluded)', async () => {
      (mockUserRepository.findOne as jest.Mock).mockResolvedValue({
        ...mockUser,
        id: '1',
      });
      await expect(service.isUsernameTaken('testuser', '1')).resolves.toBe(
        false,
      );
    });

    it('returns false when username not found', async () => {
      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.isUsernameTaken('freeuser')).resolves.toBe(false);
    });
  });

  describe('updateProfile', () => {
    it('updates fullName and username when available', async () => {
      (mockUserRepository.findOne as jest.Mock)
        .mockResolvedValueOnce(mockUser) // findById
        .mockResolvedValueOnce(null); // isUsernameTaken
      (mockUserRepository.save as jest.Mock).mockResolvedValue({
        ...mockUser,
        fullName: 'New Name',
        username: 'newname',
      });

      const result = await service.updateProfile('1', {
        fullName: 'New Name',
        username: 'newname',
      });
      expect(result.fullName).toBe('New Name');
      expect(result.username).toBe('newname');
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('throws ConflictException when username is taken', async () => {
      (mockUserRepository.findOne as jest.Mock)
        .mockResolvedValueOnce(mockUser) // findById
        .mockResolvedValueOnce({ ...mockUser, id: '2' }); // isUsernameTaken => existing different user

      await expect(
        service.updateProfile('1', {
          fullName: 'New Name',
          username: 'testuser',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
