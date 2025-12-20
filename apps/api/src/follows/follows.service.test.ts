import { BadRequestException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { FollowsService } from './follows.service';
import { Follow } from './entities/follow.entity';
import { User } from '../users/entities/user.entity';

describe('FollowsService', () => {
  const makeService = () => {
    const followRepository = {
      findOne: jest.fn(),
    };
    const userRepository = {
      findOne: jest.fn(),
    };

    const manager = {
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      increment: jest.fn(),
      decrement: jest.fn(),
    };

    const dataSource = {
      transaction: jest.fn(async (fn: (m: typeof manager) => Promise<void>) =>
        fn(manager),
      ),
    };

    const service = new FollowsService(
      followRepository as any,
      userRepository as any,
      dataSource as any,
    );

    return { service, followRepository, userRepository, dataSource, manager };
  };

  describe('getFollowStatus', () => {
    it('throws when the target user does not exist', async () => {
      const { service, userRepository } = makeService();
      userRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.getFollowStatus('u1', 'missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns true when a follow row exists', async () => {
      const { service, userRepository, followRepository } = makeService();
      userRepository.findOne.mockResolvedValueOnce({ id: 'u2' } as User);
      followRepository.findOne.mockResolvedValueOnce({ id: 'f1' } as Follow);

      await expect(service.getFollowStatus('u1', 'target')).resolves.toEqual({
        isFollowing: true,
      });
      expect(followRepository.findOne).toHaveBeenCalledWith({
        where: { followerId: 'u1', followingId: 'u2' },
      });
    });

    it('returns false when no follow row exists', async () => {
      const { service, userRepository, followRepository } = makeService();
      userRepository.findOne.mockResolvedValueOnce({ id: 'u2' } as User);
      followRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.getFollowStatus('u1', 'target')).resolves.toEqual({
        isFollowing: false,
      });
    });
  });

  describe('followUser', () => {
    it('throws when the target user does not exist', async () => {
      const { service, userRepository } = makeService();
      userRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.followUser('u1', 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects following yourself', async () => {
      const { service, userRepository } = makeService();
      userRepository.findOne.mockResolvedValueOnce({
        id: 'u1',
        username: 'me',
      } as User);

      await expect(service.followUser('u1', 'me')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('is idempotent when already following', async () => {
      const { service, userRepository, followRepository, dataSource } =
        makeService();
      userRepository.findOne.mockResolvedValueOnce({ id: 'u2' } as User);
      followRepository.findOne.mockResolvedValueOnce({ id: 'f1' } as Follow);

      await expect(service.followUser('u1', 'target')).resolves.toEqual({
        isFollowing: true,
      });
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('creates follow row and increments counters when new follow', async () => {
      const { service, userRepository, followRepository, dataSource, manager } =
        makeService();
      userRepository.findOne.mockResolvedValueOnce({ id: 'u2' } as User);
      followRepository.findOne.mockResolvedValueOnce(null);
      manager.create.mockReturnValueOnce({ id: 'f-new' });

      await expect(service.followUser('u1', 'target')).resolves.toEqual({
        isFollowing: true,
      });

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(manager.create).toHaveBeenCalledWith(Follow, {
        followerId: 'u1',
        followingId: 'u2',
      });
      expect(manager.save).toHaveBeenCalledWith({ id: 'f-new' });
      expect(manager.increment).toHaveBeenCalledWith(
        User,
        { id: 'u1' },
        'followingCount',
        1,
      );
      expect(manager.increment).toHaveBeenCalledWith(
        User,
        { id: 'u2' },
        'followerCount',
        1,
      );
    });

    it('returns true when unique constraint error occurs', async () => {
      const { service, userRepository, followRepository, dataSource } =
        makeService();
      userRepository.findOne.mockResolvedValueOnce({ id: 'u2' } as User);
      followRepository.findOne.mockResolvedValueOnce(null);

      const uniqueError = new QueryFailedError('query', [], {
        code: '23505',
      } as unknown as Error);
      dataSource.transaction.mockRejectedValueOnce(uniqueError);

      await expect(service.followUser('u1', 'target')).resolves.toEqual({
        isFollowing: true,
      });
    });
  });

  describe('unfollowUser', () => {
    it('throws when the target user does not exist', async () => {
      const { service, userRepository } = makeService();
      userRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.unfollowUser('u1', 'missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('is idempotent when not following', async () => {
      const { service, userRepository, followRepository, dataSource } =
        makeService();
      userRepository.findOne.mockResolvedValueOnce({ id: 'u2' } as User);
      followRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.unfollowUser('u1', 'target')).resolves.toEqual({
        isFollowing: false,
      });
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('deletes follow row and decrements counters when unfollowing', async () => {
      const { service, userRepository, followRepository, dataSource, manager } =
        makeService();
      userRepository.findOne.mockResolvedValueOnce({ id: 'u2' } as User);
      followRepository.findOne.mockResolvedValueOnce({ id: 'f1' } as Follow);

      await expect(service.unfollowUser('u1', 'target')).resolves.toEqual({
        isFollowing: false,
      });

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(manager.delete).toHaveBeenCalledWith(Follow, { id: 'f1' });
      expect(manager.decrement).toHaveBeenCalledWith(
        User,
        { id: 'u1' },
        'followingCount',
        1,
      );
      expect(manager.decrement).toHaveBeenCalledWith(
        User,
        { id: 'u2' },
        'followerCount',
        1,
      );
    });
  });
});
