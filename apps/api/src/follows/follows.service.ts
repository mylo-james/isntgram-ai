import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Follow } from './entities/follow.entity';
import { User } from '../users/entities/user.entity';
import { isUniqueConstraintError } from '../common/db-errors';
import { NotificationsWriter } from '../notifications/notifications.writer';

@Injectable()
export class FollowsService {
  constructor(
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly notificationsWriter: NotificationsWriter,
  ) {}

  private normalizeUsername(value: string): string {
    return value.trim().toLowerCase();
  }

  private async changeFollowCounts(
    manager: EntityManager,
    followerId: string,
    followingId: string,
    amount: 1 | -1,
  ): Promise<void> {
    const updates = [
      {
        id: followerId,
        column: 'followingCount' as const,
      },
      {
        id: followingId,
        column: 'followerCount' as const,
      },
    ].sort((left, right) => left.id.localeCompare(right.id));

    for (const update of updates) {
      if (amount === 1) {
        await manager.increment(User, { id: update.id }, update.column, 1);
      } else {
        await manager.decrement(User, { id: update.id }, update.column, 1);
      }
    }
  }

  async getFollowStatus(
    followerId: string,
    followerIsDemo: boolean,
    username: string,
  ): Promise<{ isFollowing: boolean }> {
    const normalizedUsername = this.normalizeUsername(username);
    const target = await this.userRepository.findOne({
      where: { username: normalizedUsername, isDemoUser: followerIsDemo },
    });
    if (!target) {
      throw new NotFoundException(
        `User with username "${normalizedUsername}" not found`,
      );
    }

    const existing = await this.followRepository.findOne({
      where: { followerId, followingId: target.id },
    });

    return { isFollowing: Boolean(existing) };
  }

  async followUser(
    followerId: string,
    followerIsDemo: boolean,
    username: string,
  ): Promise<{ isFollowing: boolean }> {
    const normalizedUsername = this.normalizeUsername(username);
    const target = await this.userRepository.findOne({
      where: { username: normalizedUsername, isDemoUser: followerIsDemo },
    });
    if (!target) {
      throw new NotFoundException(
        `User with username "${normalizedUsername}" not found`,
      );
    }

    if (target.id === followerId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    const existing = await this.followRepository.findOne({
      where: { followerId, followingId: target.id },
    });

    if (existing) {
      return { isFollowing: true };
    }

    try {
      await this.dataSource.transaction(async (manager) => {
        const follow = manager.create(Follow, {
          followerId,
          followingId: target.id,
        });
        const saved = await manager.save(follow);
        await this.changeFollowCounts(manager, followerId, target.id, 1);
        await this.notificationsWriter.write(manager, {
          recipientId: target.id,
          actorId: followerId,
          type: 'follow',
          sourceId: saved.id,
        });
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return { isFollowing: true };
      }
      throw error;
    }

    return { isFollowing: true };
  }

  async unfollowUser(
    followerId: string,
    followerIsDemo: boolean,
    username: string,
  ): Promise<{ isFollowing: boolean }> {
    const normalizedUsername = this.normalizeUsername(username);
    const target = await this.userRepository.findOne({
      where: { username: normalizedUsername, isDemoUser: followerIsDemo },
    });
    if (!target) {
      throw new NotFoundException(
        `User with username "${normalizedUsername}" not found`,
      );
    }

    const existing = await this.followRepository.findOne({
      where: { followerId, followingId: target.id },
    });

    if (!existing) {
      return { isFollowing: false };
    }

    await this.dataSource.transaction(async (manager) => {
      const deleted = await manager.delete(Follow, {
        followerId,
        followingId: target.id,
      });
      if (deleted.affected === 1) {
        await this.changeFollowCounts(manager, followerId, target.id, -1);
      }
    });

    return { isFollowing: false };
  }
}
