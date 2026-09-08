import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

describe('UsersService', () => {
  let service: UsersService;

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
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

  describe('getPublicProfile', () => {
    it('should return public profile DTO when user found', async () => {
      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.getPublicProfile('testuser');

      expect(result).toEqual({
        id: mockUser.id,
        username: mockUser.username,
        fullName: mockUser.fullName,
        profilePictureUrl: mockUser.profilePictureUrl,
        bio: mockUser.bio,
        postCount: mockUser.postsCount,
        followerCount: mockUser.followerCount,
        followingCount: mockUser.followingCount,
        createdAt: mockUser.createdAt.toISOString(),
        updatedAt: mockUser.updatedAt.toISOString(),
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.getPublicProfile('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getPrivateProfileById', () => {
    it('should return private profile DTO when user found', async () => {
      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.getPrivateProfileById('1');

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
        createdAt: mockUser.createdAt.toISOString(),
        updatedAt: mockUser.updatedAt.toISOString(),
      });
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

  describe('isUsernameTaken', () => {
    it('returns true for a normalized reserved route without querying users', async () => {
      await expect(service.isUsernameTaken('  NoTiFiCaTiOnS ')).resolves.toBe(
        true,
      );
      expect(mockUserRepository.findOne).not.toHaveBeenCalled();
    });

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
    it('rejects a reserved rename without reading or changing an account', async () => {
      await expect(
        service.updateProfile('1', {
          fullName: 'New Name',
          username: '  FeEd ',
        }),
      ).rejects.toThrow(ConflictException);

      expect(mockUserRepository.findOne).not.toHaveBeenCalled();
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

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

    it('throws ConflictException when unique constraint error occurs on save', async () => {
      (mockUserRepository.findOne as jest.Mock)
        .mockResolvedValueOnce(mockUser) // findById
        .mockResolvedValueOnce(null); // isUsernameTaken

      const error = new QueryFailedError('query', [], {
        code: '23505',
      } as unknown as Error);
      (mockUserRepository.save as jest.Mock).mockRejectedValueOnce(error);

      await expect(
        service.updateProfile('1', {
          fullName: 'New Name',
          username: 'newname',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
