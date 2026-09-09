import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { MediaService } from '../media/media.service';

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
    createQueryBuilder: jest.fn(),
  } as unknown as jest.Mocked<Repository<User>>;
  const mockMediaRepository = { update: jest.fn() };
  const mockDataSource = {
    transaction: jest.fn(async (work) =>
      work({
        getRepository: jest.fn((entity) =>
          entity === User ? mockUserRepository : mockMediaRepository,
        ),
      }),
    ),
  };
  const mockMediaService = {
    getOwnedUpload: jest.fn(),
    getPublishedUrl: jest.fn(),
    preparePublication: jest.fn(),
    completeUploadReservation: jest.fn(),
    recordOrphan: jest.fn(),
    toDisplayUrl: jest.fn((value) => value),
  };

  beforeEach(async () => {
    mockMediaService.toDisplayUrl.mockImplementation((value) => value);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: getDataSourceToken(), useValue: mockDataSource },
        { provide: MediaService, useValue: mockMediaService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('searchUsers', () => {
    it('projects avatar URLs for phone-view search results', async () => {
      const canonical = 'http://127.0.0.1:48333/media/published/avatar';
      const display = 'https://phone-preview.example/media/published/avatar';
      const qb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue([{ ...mockUser, profilePictureUrl: canonical }]),
      };
      mockUserRepository.createQueryBuilder.mockReturnValue(qb as never);
      mockMediaService.toDisplayUrl.mockImplementation((value) =>
        value === canonical ? display : value,
      );
      const result = await service.searchUsers(true, { q: 'test', limit: 10 });
      expect(result.items).toEqual([
        {
          id: mockUser.id,
          username: mockUser.username,
          fullName: mockUser.fullName,
          profilePictureUrl: display,
        },
      ]);
      expect(mockMediaService.toDisplayUrl).toHaveBeenCalledWith(canonical);
      expect(qb.where).toHaveBeenCalledWith('user.isDemoUser = :viewerIsDemo', {
        viewerIsDemo: true,
      });
    });
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

  it('projects a canonical avatar URL only in public profile output', () => {
    const canonical =
      'http://127.0.0.1:48333/isntgram-v1-media/published/550e8400-e29b-41d4-a716-446655440000/660e8400-e29b-41d4-a716-846655440000';
    const display =
      'https://phone.example:9444/isntgram-v1-media/published/550e8400-e29b-41d4-a716-446655440000/660e8400-e29b-41d4-a716-846655440000';
    mockMediaService.toDisplayUrl.mockReturnValue(display);

    expect(
      service.toPublicProfileDto({ ...mockUser, profilePictureUrl: canonical }),
    ).toMatchObject({
      profilePictureUrl: display,
    });
    expect(mockMediaService.toDisplayUrl).toHaveBeenCalledWith(canonical);
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

    it('binds a verified owned upload to the profile in the same transaction', async () => {
      (mockUserRepository.findOne as jest.Mock)
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(null);
      const prepared = {
        uploadId: 'upload-1',
        ownerId: '1',
        publishedKey: 'published/1/photo-id',
        publishedUrl: 'https://cdn.example.com/published/1/photo-id',
        checksum: 'a'.repeat(64),
        contentType: 'image/jpeg',
        bytes: 42,
        width: 10,
        height: 10,
        frames: 1,
      };
      mockMediaService.getOwnedUpload.mockResolvedValue({
        id: 'upload-1',
        ownerId: '1',
      });
      mockMediaService.getPublishedUrl.mockReturnValue(undefined);
      mockMediaService.preparePublication.mockResolvedValue(prepared);
      (mockUserRepository.save as jest.Mock).mockImplementation(
        async (user) => ({ ...user }),
      );
      mockMediaRepository.update.mockResolvedValue({ affected: 1 });

      await expect(
        service.updateProfile('1', {
          fullName: 'New Name',
          username: 'newname',
          profilePictureUploadId: 'upload-1',
        }),
      ).resolves.toMatchObject({ profilePictureUrl: prepared.publishedUrl });

      expect(mockMediaRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'upload-1',
          ownerId: '1',
          postId: expect.any(Object),
          profilePictureUserId: expect.any(Object),
        }),
        expect.objectContaining({
          profilePictureUserId: '1',
          publishedKey: prepared.publishedKey,
        }),
      );
    });

    it('refuses a photo upload that is not owned by the profile user before preparation', async () => {
      (mockUserRepository.findOne as jest.Mock)
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(null);
      mockMediaService.getOwnedUpload.mockRejectedValue(
        new NotFoundException('Media upload was not found'),
      );

      await expect(
        service.updateProfile('1', {
          fullName: 'New Name',
          username: 'newname',
          profilePictureUploadId: 'upload-owned-by-someone-else',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(mockMediaService.preparePublication).not.toHaveBeenCalled();
    });

    it('does not prepare an upload already consumed as a profile photo and replays the saved profile', async () => {
      (mockUserRepository.findOne as jest.Mock)
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(null);
      mockMediaService.getOwnedUpload.mockResolvedValue({
        id: 'upload-1',
        ownerId: '1',
        profilePictureUserId: '1',
        publishedKey: 'published/1/photo-id',
      });
      mockMediaService.getPublishedUrl.mockReturnValue(
        mockUser.profilePictureUrl,
      );
      (mockUserRepository.save as jest.Mock).mockImplementation(
        async (user) => ({ ...user }),
      );

      await expect(
        service.updateProfile('1', {
          fullName: 'New Name',
          username: 'newname',
          profilePictureUploadId: 'upload-1',
        }),
      ).resolves.toMatchObject({
        profilePictureUrl: mockUser.profilePictureUrl,
      });

      expect(mockMediaService.preparePublication).not.toHaveBeenCalled();
    });

    it('records an orphan and preserves the refusal when the profile claim loses the race', async () => {
      (mockUserRepository.findOne as jest.Mock)
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(null);
      const prepared = {
        uploadId: 'upload-1',
        ownerId: '1',
        publishedKey: 'published/1/photo-id',
        publishedUrl: 'https://cdn.example.com/published/1/photo-id',
        checksum: 'a'.repeat(64),
        contentType: 'image/jpeg',
        bytes: 42,
        width: 10,
        height: 10,
        frames: 1,
      };
      mockMediaService.getOwnedUpload.mockResolvedValue({
        id: 'upload-1',
        ownerId: '1',
      });
      mockMediaService.getPublishedUrl.mockReturnValue(undefined);
      mockMediaService.preparePublication.mockResolvedValue(prepared);
      (mockUserRepository.save as jest.Mock).mockImplementation(
        async (user) => ({ ...user }),
      );
      mockMediaRepository.update.mockResolvedValue({ affected: 0 });

      await expect(
        service.updateProfile('1', {
          fullName: 'New Name',
          username: 'newname',
          profilePictureUploadId: 'upload-1',
        }),
      ).rejects.toThrow('Media upload is no longer available');
      expect(mockMediaService.recordOrphan).toHaveBeenCalledWith(
        prepared,
        'profile_transaction_failed',
      );
    });

    it('waits for a durable profile orphan intent before returning a failed claim', async () => {
      (mockUserRepository.findOne as jest.Mock)
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(null);
      const prepared = {
        uploadId: 'upload-1', ownerId: '1', publishedKey: 'published/1/photo-id',
        publishedUrl: 'https://cdn.example.com/published/1/photo-id', checksum: 'a'.repeat(64),
        contentType: 'image/jpeg', bytes: 42, width: 10, height: 10, frames: 1,
      };
      let persist!: () => void;
      mockMediaService.getOwnedUpload.mockResolvedValue({ id: 'upload-1', ownerId: '1' });
      mockMediaService.getPublishedUrl.mockReturnValue(undefined);
      mockMediaService.preparePublication.mockResolvedValue(prepared);
      (mockUserRepository.save as jest.Mock).mockImplementation(async (user) => ({ ...user }));
      mockMediaRepository.update.mockResolvedValue({ affected: 0 });
      mockMediaService.recordOrphan.mockImplementation(
        () => new Promise<void>((resolve) => { persist = resolve; }),
      );

      const result = service.updateProfile('1', {
        fullName: 'New Name', username: 'newname', profilePictureUploadId: 'upload-1',
      });
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(mockMediaService.recordOrphan).toHaveBeenCalledWith(
        prepared,
        'profile_transaction_failed',
      );
      expect(mockMediaService.completeUploadReservation).not.toHaveBeenCalled();

      persist();
      await expect(result).rejects.toThrow('Media upload is no longer available');
    });
  });
});
