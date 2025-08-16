import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FollowsService } from './follows.service';
import { Follows } from './entities/follows.entity';
import { User } from '../users/entities/user.entity';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

describe('FollowsService', () => {
  let service: FollowsService;
  let followsRepository: jest.Mocked<Repository<Follows>>;
  let userRepository: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FollowsService,
        {
          provide: getRepositoryToken(Follows),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            increment: jest.fn(),
            decrement: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FollowsService>(FollowsService);
    followsRepository = module.get(getRepositoryToken(Follows));
    userRepository = module.get(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('followUser', () => {
    it('should throw when trying to follow self', async () => {
      await expect(service.followUser('u1', 'u1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should throw NotFound when follower or following does not exist', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValueOnce(null); // follower missing
      await expect(service.followUser('a', 'b')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('should throw Conflict when already following', async () => {
      (userRepository.findOne as jest.Mock)
        .mockResolvedValueOnce({ id: 'a' } as User)
        .mockResolvedValueOnce({ id: 'b' } as User);
      (followsRepository.findOne as jest.Mock).mockResolvedValueOnce({
        followerId: 'a',
        followingId: 'b',
      } as Follows);

      await expect(service.followUser('a', 'b')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('should create follow and update counts', async () => {
      (userRepository.findOne as jest.Mock)
        .mockResolvedValueOnce({ id: 'a' } as User)
        .mockResolvedValueOnce({ id: 'b' } as User);
      (followsRepository.findOne as jest.Mock).mockResolvedValueOnce(null);

      await service.followUser('a', 'b');

      expect(followsRepository.save).toHaveBeenCalledWith({
        followerId: 'a',
        followingId: 'b',
      });
      expect(userRepository.increment).toHaveBeenCalledWith(
        { id: 'b' },
        'followerCount',
        1,
      );
      expect(userRepository.increment).toHaveBeenCalledWith(
        { id: 'a' },
        'followingCount',
        1,
      );
    });
  });

  describe('unfollowUser', () => {
    it('should throw when trying to unfollow self', async () => {
      await expect(service.unfollowUser('u1', 'u1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should throw NotFound when follow relationship missing', async () => {
      (userRepository.findOne as jest.Mock)
        .mockResolvedValueOnce({ id: 'a' } as User)
        .mockResolvedValueOnce({ id: 'b' } as User);
      (followsRepository.findOne as jest.Mock).mockResolvedValueOnce(null);

      await expect(service.unfollowUser('a', 'b')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('should delete follow and update counts', async () => {
      (userRepository.findOne as jest.Mock)
        .mockResolvedValueOnce({ id: 'a' } as User)
        .mockResolvedValueOnce({ id: 'b' } as User);
      (followsRepository.findOne as jest.Mock).mockResolvedValueOnce({
        followerId: 'a',
        followingId: 'b',
      } as Follows);

      await service.unfollowUser('a', 'b');

      expect(followsRepository.delete).toHaveBeenCalledWith({
        followerId: 'a',
        followingId: 'b',
      });
      expect(userRepository.decrement).toHaveBeenCalledWith(
        { id: 'b' },
        'followerCount',
        1,
      );
      expect(userRepository.decrement).toHaveBeenCalledWith(
        { id: 'a' },
        'followingCount',
        1,
      );
    });
  });

  describe('get counts', () => {
    it('should return follower count', async () => {
      (followsRepository.count as jest.Mock).mockResolvedValueOnce(5);
      await expect(service.getFollowerCount('x')).resolves.toBe(5);
    });

    it('should return following count', async () => {
      (followsRepository.count as jest.Mock).mockResolvedValueOnce(7);
      await expect(service.getFollowingCount('x')).resolves.toBe(7);
    });
  });

  describe('isFollowing', () => {
    it('should return false for invalid or self ids', async () => {
      await expect(service.isFollowing('', 'x')).resolves.toBe(false);
      await expect(service.isFollowing('x', '')).resolves.toBe(false);
      await expect(service.isFollowing('x', 'x')).resolves.toBe(false);
    });

    it('should return true when relationship exists', async () => {
      (followsRepository.findOne as jest.Mock).mockResolvedValueOnce({
        followerId: 'a',
        followingId: 'b',
      });
      await expect(service.isFollowing('a', 'b')).resolves.toBe(true);
    });

    it('should return false when relationship missing', async () => {
      (followsRepository.findOne as jest.Mock).mockResolvedValueOnce(null);
      await expect(service.isFollowing('a', 'b')).resolves.toBe(false);
    });
  });
});
