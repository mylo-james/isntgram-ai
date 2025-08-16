import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { FollowsService } from './follows.service';
import { Follow } from './entities/follows.entity';
import { User } from '../users/entities/user.entity';
import { FollowDto } from './dto/follow.dto';

describe('FollowsService', () => {
  let service: FollowsService;
  let followRepository: jest.Mocked<Repository<Follow>>;
  let userRepository: jest.Mocked<Repository<User>>;

  const mockUser: User = {
    id: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
    fullName: 'Test User',
    hashedPassword: 'hashedpassword',
    postsCount: 0,
    followerCount: 0,
    followingCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTargetUser: User = {
    id: 'user-2',
    username: 'targetuser',
    email: 'target@example.com',
    fullName: 'Target User',
    hashedPassword: 'hashedpassword',
    postsCount: 0,
    followerCount: 0,
    followingCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockFollow: Follow = {
    id: 'follow-1',
    followerId: 'user-1',
    followingId: 'user-2',
    follower: mockUser,
    following: mockTargetUser,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const mockFollowRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
      count: jest.fn(),
      find: jest.fn(),
    };

    const mockUserRepository = {
      findOne: jest.fn(),
      increment: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FollowsService,
        {
          provide: getRepositoryToken(Follow),
          useValue: mockFollowRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<FollowsService>(FollowsService);
    followRepository = module.get(getRepositoryToken(Follow));
    userRepository = module.get(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('followUser', () => {
    const followDto: FollowDto = { userId: 'user-2' };

    it('should successfully follow a user', async () => {
      userRepository.findOne.mockResolvedValue(mockTargetUser);
      followRepository.findOne.mockResolvedValue(null);
      followRepository.create.mockReturnValue(mockFollow);
      followRepository.save.mockResolvedValue(mockFollow);
      userRepository.increment.mockResolvedValue(undefined);

      const result = await service.followUser('user-1', followDto);

      expect(result).toEqual({
        id: mockFollow.id,
        followerId: mockFollow.followerId,
        followingId: mockFollow.followingId,
        createdAt: mockFollow.createdAt,
      });
      expect(userRepository.increment).toHaveBeenCalledTimes(2);
    });

    it('should throw BadRequestException when trying to follow self', async () => {
      await expect(service.followUser('user-1', { userId: 'user-1' }))
        .rejects
        .toThrow(BadRequestException);
    });

    it('should throw NotFoundException when target user does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.followUser('user-1', followDto))
        .rejects
        .toThrow(NotFoundException);
    });

    it('should throw ConflictException when already following', async () => {
      userRepository.findOne.mockResolvedValue(mockTargetUser);
      followRepository.findOne.mockResolvedValue(mockFollow);

      await expect(service.followUser('user-1', followDto))
        .rejects
        .toThrow(ConflictException);
    });
  });

  describe('unfollowUser', () => {
    const followDto: FollowDto = { userId: 'user-2' };

    it('should successfully unfollow a user', async () => {
      followRepository.findOne.mockResolvedValue(mockFollow);
      followRepository.remove.mockResolvedValue(mockFollow);
      userRepository.increment.mockResolvedValue(undefined);

      const result = await service.unfollowUser('user-1', followDto);

      expect(result).toEqual({ message: 'Successfully unfollowed user' });
      expect(followRepository.remove).toHaveBeenCalledWith(mockFollow);
      expect(userRepository.increment).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundException when not following user', async () => {
      followRepository.findOne.mockResolvedValue(null);

      await expect(service.unfollowUser('user-1', followDto))
        .rejects
        .toThrow(NotFoundException);
    });
  });

  describe('getFollowStats', () => {
    it('should return follow stats for different users', async () => {
      followRepository.count
        .mockResolvedValueOnce(10) // follower count
        .mockResolvedValueOnce(5); // following count
      followRepository.findOne.mockResolvedValue(mockFollow);

      const result = await service.getFollowStats('user-1', 'user-2');

      expect(result).toEqual({
        followerCount: 10,
        followingCount: 5,
        isFollowing: true,
      });
    });

    it('should return follow stats for same user', async () => {
      followRepository.count
        .mockResolvedValueOnce(10) // follower count
        .mockResolvedValueOnce(5); // following count

      const result = await service.getFollowStats('user-1', 'user-1');

      expect(result).toEqual({
        followerCount: 10,
        followingCount: 5,
        isFollowing: false,
      });
      expect(followRepository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('getFollowers', () => {
    it('should return list of followers', async () => {
      const followsWithFollowers = [
        { ...mockFollow, follower: mockUser },
      ];
      followRepository.find.mockResolvedValue(followsWithFollowers);

      const result = await service.getFollowers('user-2');

      expect(result).toEqual([mockUser]);
      expect(followRepository.find).toHaveBeenCalledWith({
        where: { followingId: 'user-2' },
        relations: ['follower'],
      });
    });
  });

  describe('getFollowing', () => {
    it('should return list of following users', async () => {
      const followsWithFollowing = [
        { ...mockFollow, following: mockTargetUser },
      ];
      followRepository.find.mockResolvedValue(followsWithFollowing);

      const result = await service.getFollowing('user-1');

      expect(result).toEqual([mockTargetUser]);
      expect(followRepository.find).toHaveBeenCalledWith({
        where: { followerId: 'user-1' },
        relations: ['following'],
      });
    });
  });
});