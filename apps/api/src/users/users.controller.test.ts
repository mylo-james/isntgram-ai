import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PublicUserProfileDto } from './dto/public-user-profile.dto';
import { PrivateUserProfileDto } from './dto/private-user-profile.dto';
import { AuthUser } from '../auth/jwt.types';

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

  const mockPrivateProfile: PrivateUserProfileDto = {
    ...mockPublicProfile,
    email: 'test@example.com',
    createdAt: new Date('2023-01-01').toISOString(),
    updatedAt: new Date('2023-01-01').toISOString(),
  };

  const mockUsersService = {
    getPublicProfile: jest.fn(),
    getPrivateProfileById: jest.fn(),
    isUsernameTaken: jest.fn(),
    updateProfile: jest.fn(),
    findById: jest.fn(),
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
      (mockUsersService.getPublicProfile as jest.Mock).mockResolvedValue(
        mockPublicProfile,
      );

      const result = await controller.getUserProfile('testuser');

      expect(result).toEqual(mockPublicProfile);
      expect(usersService.getPublicProfile).toHaveBeenCalledWith('testuser');
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
        (mockUsersService.getPublicProfile as jest.Mock).mockResolvedValue(
          mockPublicProfile,
        );

        const result = await controller.getUserProfile(username);

        expect(result).toEqual(mockPublicProfile);
        expect(usersService.getPublicProfile).toHaveBeenCalledWith(username);
      }
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
      const updated: PrivateUserProfileDto = {
        ...mockPrivateProfile,
        username: 'newname',
        fullName: 'New Name',
      };
      (mockUsersService.updateProfile as jest.Mock).mockResolvedValue(updated);
      const body = { fullName: 'New Name', username: 'newname' };
      const req = { user: { userId: '1' } } as unknown as Request & {
        user: AuthUser;
      };

      const result = await controller.updateProfile(req, body as never);

      expect(result).toEqual(updated);
      expect(usersService.updateProfile).toHaveBeenCalledWith('1', {
        fullName: 'New Name',
        username: 'newname',
      });
    });
  });

  describe('getCurrentUser', () => {
    it('should return private profile for authenticated user', async () => {
      (mockUsersService.getPrivateProfileById as jest.Mock).mockResolvedValue(
        mockPrivateProfile,
      );
      const req = { user: { userId: '1' } } as unknown as Request & {
        user: AuthUser;
      };

      const result = await controller.getCurrentUser(req);

      expect(result).toEqual(mockPrivateProfile);
      expect(usersService.getPrivateProfileById).toHaveBeenCalledWith('1');
    });
  });
});
