import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { MyProfileDto } from './dto/my-profile.dto';
import { PublicUserProfileDto } from './dto/public-user-profile.dto';
import { FollowListResponseDto } from './dto/follow-list-response.dto';
import { FollowListUserDto } from './dto/follow-list-user.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: UsersService;

  const mockPublicProfile: PublicUserProfileDto = {
    id: '1',
    username: 'testuser',
    fullName: 'Test User',
    profilePictureUrl: 'https://example.com/avatar.jpg',
    bio: 'Test bio',
    postCount: 10,
    followerCount: 100,
    followingCount: 50,
    createdAt: new Date('2023-01-01').toISOString(),
    updatedAt: new Date('2023-01-01').toISOString(),
  };

  const mockMyProfile: MyProfileDto = {
    ...mockPublicProfile,
    email: 'test@example.com',
  };

  const mockFollowUser: FollowListUserDto = {
    id: '2',
    username: 'follower',
    fullName: 'Follower User',
    profilePictureUrl: 'https://example.com/follower.jpg',
    isFollowing: false,
  };

  const mockUsersService = {
    getUserProfile: jest.fn(),
    isUsernameTaken: jest.fn(),
    updateProfile: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
    toMyProfileDto: jest.fn(),
    getFollowers: jest.fn(),
    getFollowing: jest.fn(),
  } as unknown as jest.Mocked<UsersService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserProfile', () => {
    it('should return user profile when user exists', async () => {
      (mockUsersService.getUserProfile as jest.Mock).mockResolvedValue(
        mockPublicProfile,
      );

      const result = await controller.getUserProfile('testuser');

      expect(result).toEqual(mockPublicProfile);
      expect(usersService.getUserProfile).toHaveBeenCalledWith('testuser');
    });

    it('should handle various username formats', async () => {
      const usernames = [
        'user123',
        'user_name',
        'user-name',
        'user.name',
        'USER',
      ];

      for (const username of usernames) {
        (mockUsersService.getUserProfile as jest.Mock).mockResolvedValue(
          mockPublicProfile,
        );

        const result = await controller.getUserProfile(username);

        expect(result).toEqual(mockPublicProfile);
        expect(usersService.getUserProfile).toHaveBeenCalledWith(username);
      }
    });

    it('should return correct HTTP status code', async () => {
      const method = controller.getUserProfile;
      const metadata = Reflect.getMetadata('__httpCode__', method);
      expect(typeof method).toBe('function');
      expect(metadata).toBe(HttpStatus.OK);
    });
  });

  describe('checkUsername', () => {
    it('should return available false when username is taken', async () => {
      (mockUsersService.isUsernameTaken as jest.Mock).mockResolvedValue(true);
      const result = await controller.checkUsername('taken');
      expect(result).toEqual({ available: false });
      expect(usersService.isUsernameTaken).toHaveBeenCalledWith('taken');
    });

    it('should return available true when username is not taken', async () => {
      (mockUsersService.isUsernameTaken as jest.Mock).mockResolvedValue(false);
      const result = await controller.checkUsername('free');
      expect(result).toEqual({ available: true });
      expect(usersService.isUsernameTaken).toHaveBeenCalledWith('free');
    });
  });

  describe('updateProfile', () => {
    it('should update user profile and return dto', async () => {
      const updated: MyProfileDto = {
        ...mockMyProfile,
        username: 'newname',
        fullName: 'New Name',
      };
      (mockUsersService.updateProfile as jest.Mock).mockResolvedValue(updated);
      const body = { fullName: 'New Name', username: 'newname' };

      const result = await controller.updateProfile(
        { user: { userId: '1' } } as never,
        body as never,
      );

      expect(result).toEqual(updated);
      expect(usersService.updateProfile).toHaveBeenCalledWith('1', {
        fullName: 'New Name',
        username: 'newname',
      });
    });
  });

  describe('getMe', () => {
    it('returns current user profile', async () => {
      const mockUser = { id: '1' };
      (mockUsersService.findById as jest.Mock).mockResolvedValue(mockUser);
      (mockUsersService.toMyProfileDto as jest.Mock).mockResolvedValue(
        mockMyProfile,
      );

      const result = await controller.getMe({ user: { userId: '1' } } as never);

      expect(result).toEqual(mockMyProfile);
      expect(usersService.findById).toHaveBeenCalledWith('1');
      expect(usersService.toMyProfileDto).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('getFollowers', () => {
    const mockFollowersResult: FollowListResponseDto = {
      users: [mockFollowUser],
      pagination: { page: 1, limit: 20, total: 1, hasMore: false },
    };

    it('should return followers with default pagination', async () => {
      (mockUsersService.getFollowers as jest.Mock).mockResolvedValue(
        mockFollowersResult,
      );

      const result = await controller.getFollowers('testuser', {} as never);

      expect(result).toEqual(mockFollowersResult);
      expect(usersService.getFollowers).toHaveBeenCalledWith(
        'testuser',
        1,
        20,
        undefined,
      );
    });

    it('should return followers with custom pagination', async () => {
      (mockUsersService.getFollowers as jest.Mock).mockResolvedValue(
        mockFollowersResult,
      );

      const result = await controller.getFollowers(
        'testuser',
        {} as never,
        2,
        10,
      );

      expect(result).toEqual(mockFollowersResult);
      expect(usersService.getFollowers).toHaveBeenCalledWith(
        'testuser',
        2,
        10,
        undefined,
      );
    });

    it('should enforce limit boundaries', async () => {
      (mockUsersService.getFollowers as jest.Mock).mockResolvedValue(
        mockFollowersResult,
      );

      // Clear previous calls
      jest.clearAllMocks();

      // Test that 0 defaults to 20 (since Number(0) || 20 = 20)
      await controller.getFollowers('testuser', {} as never, 1, 0);
      expect(usersService.getFollowers).toHaveBeenCalledWith(
        'testuser',
        1,
        20,
        undefined,
      );

      // Clear and test maximum limit enforcement
      jest.clearAllMocks();
      await controller.getFollowers('testuser', {} as never, 1, 200);
      expect(usersService.getFollowers).toHaveBeenCalledWith(
        'testuser',
        1,
        100,
        undefined,
      );

      // Test that very small positive numbers get clamped to 1
      jest.clearAllMocks();
      await controller.getFollowers('testuser', {} as never, 1, -5);
      expect(usersService.getFollowers).toHaveBeenCalledWith(
        'testuser',
        1,
        1,
        undefined,
      );
    });
  });

  describe('getFollowing', () => {
    const mockFollowingResult: FollowListResponseDto = {
      users: [mockFollowUser],
      pagination: { page: 1, limit: 20, total: 1, hasMore: false },
    };

    it('should return following with default pagination', async () => {
      (mockUsersService.getFollowing as jest.Mock).mockResolvedValue(
        mockFollowingResult,
      );

      const result = await controller.getFollowing('testuser', {} as never);

      expect(result).toEqual(mockFollowingResult);
      expect(usersService.getFollowing).toHaveBeenCalledWith(
        'testuser',
        1,
        20,
        undefined,
      );
    });

    it('should return following with custom pagination', async () => {
      (mockUsersService.getFollowing as jest.Mock).mockResolvedValue(
        mockFollowingResult,
      );

      const result = await controller.getFollowing(
        'testuser',
        {} as never,
        2,
        10,
      );

      expect(result).toEqual(mockFollowingResult);
      expect(usersService.getFollowing).toHaveBeenCalledWith(
        'testuser',
        2,
        10,
        undefined,
      );
    });

    it('should enforce limit boundaries', async () => {
      (mockUsersService.getFollowing as jest.Mock).mockResolvedValue(
        mockFollowingResult,
      );

      // Clear previous calls
      jest.clearAllMocks();

      // Test that 0 defaults to 20 (since Number(0) || 20 = 20)
      await controller.getFollowing('testuser', {} as never, 1, 0);
      expect(usersService.getFollowing).toHaveBeenCalledWith(
        'testuser',
        1,
        20,
        undefined,
      );

      // Clear and test maximum limit enforcement
      jest.clearAllMocks();
      await controller.getFollowing('testuser', {} as never, 1, 200);
      expect(usersService.getFollowing).toHaveBeenCalledWith(
        'testuser',
        1,
        100,
        undefined,
      );

      // Test that very small positive numbers get clamped to 1
      jest.clearAllMocks();
      await controller.getFollowing('testuser', {} as never, 1, -5);
      expect(usersService.getFollowing).toHaveBeenCalledWith(
        'testuser',
        1,
        1,
        undefined,
      );
    });
  });
});
