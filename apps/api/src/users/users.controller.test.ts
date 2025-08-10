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
    isUsernameTaken: jest.fn(),
    updateProfile: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
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
        mockUserProfile,
      );

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
        (mockUsersService.getUserProfile as jest.Mock).mockResolvedValue(
          mockUserProfile,
        );

        const result = await controller.getUserProfile(username);

        expect(result).toEqual(mockUserProfile);
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
      const updated: UserProfileDto = {
        ...mockUserProfile,
        username: 'newname',
        fullName: 'New Name',
      };
      (mockUsersService.updateProfile as jest.Mock).mockResolvedValue(updated);
      const body = { id: '1', fullName: 'New Name', username: 'newname' };

      const result = await controller.updateProfile(body as never);

      expect(result).toEqual(updated);
      expect(usersService.updateProfile).toHaveBeenCalledWith('1', {
        fullName: 'New Name',
        username: 'newname',
      });
    });
  });
});
