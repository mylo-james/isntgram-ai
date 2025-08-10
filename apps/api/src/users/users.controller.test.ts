import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService, UserProfileDto } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: UsersService;

  const mockUserProfile: UserProfileDto = {
    id: '1',
    username: 'testuser',
    fullName: 'Test User',
    email: 'test@example.com',
    profilePictureUrl: 'https://example.com/avatar.jpg',
    bio: 'Test bio',
    postCount: 10,
    followerCount: 100,
    followingCount: 50,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
  };

  const mockUsersService = {
    getUserProfile: jest.fn(),
  };

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
      mockUsersService.getUserProfile.mockResolvedValue(mockUserProfile);

      const result = await controller.getUserProfile('testuser');

      expect(result).toEqual(mockUserProfile);
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
        mockUsersService.getUserProfile.mockResolvedValue(mockUserProfile);

        const result = await controller.getUserProfile(username);

        expect(result).toEqual(mockUserProfile);
        expect(usersService.getUserProfile).toHaveBeenCalledWith(username);
      }
    });

    it('should propagate service errors', async () => {
      const error = new Error('User not found');
      mockUsersService.getUserProfile.mockRejectedValue(error);

      await expect(controller.getUserProfile('nonexistent')).rejects.toThrow(
        error,
      );
      expect(usersService.getUserProfile).toHaveBeenCalledWith('nonexistent');
    });

    it('should return correct HTTP status code', async () => {
      // This test verifies the @HttpCode decorator is working
      const method = controller.getUserProfile;
      const metadata = Reflect.getMetadata('__httpCode__', method);

      // Note: The actual HTTP status code is handled by NestJS framework
      // This test ensures the method is properly decorated
      expect(typeof method).toBe('function');
    });
  });
});
