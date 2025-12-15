import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;

  beforeEach(async () => {
    const followsInsertExecute = jest.fn();
    const followsInsertOrIgnore = jest.fn(() => ({
      execute: followsInsertExecute,
    }));
    const followsInsertValues = jest.fn(() => ({
      orIgnore: followsInsertOrIgnore,
    }));
    const followsInsertInto = jest.fn(() => ({ values: followsInsertValues }));
    const followsInsert = jest.fn(() => ({ into: followsInsertInto }));

    const followsRepoMock = {
      createQueryBuilder: jest.fn(() => ({ insert: followsInsert })),
      delete: jest.fn(),
      count: jest.fn(),
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<Follows>>;

    const userRepoMock = {
      findOne: jest.fn(),
      increment: jest.fn(),
      decrement: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;

    const mockManager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Follows) return followsRepoMock;
        if (entity === User) return userRepoMock;
        throw new Error('Unexpected repository request');
      }),
    };

    const dataSourceMock = {
      transaction: jest.fn(
        async (fn: (manager: typeof mockManager) => unknown) => fn(mockManager),
      ),
    } as unknown as jest.Mocked<Pick<DataSource, 'transaction'>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FollowsService,
        {
          provide: getRepositoryToken(Follows),
          useValue: followsRepoMock,
        },
        {
          provide: getRepositoryToken(User),
          useValue: userRepoMock,
        },
        {
          provide: DataSource,
          useValue: dataSourceMock,
        },
      ],
    }).compile();

    service = module.get<FollowsService>(FollowsService);
    followsRepository = module.get(getRepositoryToken(Follows));
    userRepository = module.get(getRepositoryToken(User));
    dataSource = module.get(DataSource);
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
      (followsRepository.createQueryBuilder as jest.Mock)()
        .insert()
        .into()
        .values()
        .orIgnore()
        .execute.mockResolvedValueOnce({
          identifiers: [],
        });

      await expect(service.followUser('a', 'b')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('should create follow and update counts', async () => {
      (userRepository.findOne as jest.Mock)
        .mockResolvedValueOnce({ id: 'a' } as User)
        .mockResolvedValueOnce({ id: 'b' } as User);
      (followsRepository.createQueryBuilder as jest.Mock)()
        .insert()
        .into()
        .values()
        .orIgnore()
        .execute.mockResolvedValueOnce({
          identifiers: [{ id: 'rel' }],
        });

      await service.followUser('a', 'b');

      expect(dataSource.transaction).toHaveBeenCalled();
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
      (followsRepository.delete as jest.Mock).mockResolvedValueOnce({
        affected: 0,
      });

      await expect(service.unfollowUser('a', 'b')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('should delete follow and update counts', async () => {
      (userRepository.findOne as jest.Mock)
        .mockResolvedValueOnce({ id: 'a' } as User)
        .mockResolvedValueOnce({ id: 'b' } as User);
      (followsRepository.delete as jest.Mock).mockResolvedValueOnce({
        affected: 1,
      });

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
