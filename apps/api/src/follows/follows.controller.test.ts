import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FollowsController } from './follows.controller';
import { FollowsService } from './follows.service';
import { FollowDto } from './dto/follow.dto';

describe('FollowsController', () => {
  let controller: FollowsController;
  let service: jest.Mocked<FollowsService>;

  const mockRequest = {
    user: { sub: 'user-1' },
  };

  const mockFollowResponse = {
    id: 'follow-1',
    followerId: 'user-1',
    followingId: 'user-2',
    createdAt: new Date(),
  };

  const mockFollowStats = {
    followerCount: 10,
    followingCount: 5,
    isFollowing: true,
  };

  beforeEach(async () => {
    const mockService = {
      followUser: jest.fn(),
      unfollowUser: jest.fn(),
      getFollowStats: jest.fn(),
      getFollowers: jest.fn(),
      getFollowing: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FollowsController],
      providers: [
        {
          provide: FollowsService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<FollowsController>(FollowsController);
    service = module.get(FollowsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('followUser', () => {
    it('should follow a user successfully', async () => {
      const followDto: FollowDto = { userId: 'user-2' };
      service.followUser.mockResolvedValue(mockFollowResponse);

      const result = await controller.followUser(mockRequest, followDto);

      expect(result).toEqual(mockFollowResponse);
      expect(service.followUser).toHaveBeenCalledWith('user-1', followDto);
    });
  });

  describe('unfollowUser', () => {
    it('should unfollow a user successfully', async () => {
      const followDto: FollowDto = { userId: 'user-2' };
      const unfollowResponse = { message: 'Successfully unfollowed user' };
      service.unfollowUser.mockResolvedValue(unfollowResponse);

      const result = await controller.unfollowUser(mockRequest, followDto);

      expect(result).toEqual(unfollowResponse);
      expect(service.unfollowUser).toHaveBeenCalledWith('user-1', followDto);
    });
  });

  describe('getFollowStats', () => {
    it('should return follow stats', async () => {
      service.getFollowStats.mockResolvedValue(mockFollowStats);

      const result = await controller.getFollowStats(mockRequest, 'user-2');

      expect(result).toEqual(mockFollowStats);
      expect(service.getFollowStats).toHaveBeenCalledWith('user-1', 'user-2');
    });
  });

  describe('getFollowers', () => {
    it('should return followers list', async () => {
      const mockFollowers = [{ id: 'user-3', username: 'follower1' }];
      service.getFollowers.mockResolvedValue(mockFollowers as any);

      const result = await controller.getFollowers('user-1');

      expect(result).toEqual(mockFollowers);
      expect(service.getFollowers).toHaveBeenCalledWith('user-1');
    });
  });

  describe('getFollowing', () => {
    it('should return following list', async () => {
      const mockFollowing = [{ id: 'user-4', username: 'following1' }];
      service.getFollowing.mockResolvedValue(mockFollowing as any);

      const result = await controller.getFollowing('user-1');

      expect(result).toEqual(mockFollowing);
      expect(service.getFollowing).toHaveBeenCalledWith('user-1');
    });
  });
});