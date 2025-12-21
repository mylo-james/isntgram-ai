import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Follow } from './entities/follow.entity';
import { User } from '../users/entities/user.entity';
import { isUniqueConstraintError } from '../common/db-errors';

@Injectable()
export class FollowsService {
  constructor(
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async getFollowStatus(
    followerId: string,
    username: string,
  ): Promise<{ isFollowing: boolean }> {
    const target = await this.userRepository.findOne({ where: { username } });
    if (!target) {
      throw new NotFoundException(`User with username "${username}" not found`);
    }

    const existing = await this.followRepository.findOne({
      where: { followerId, followingId: target.id },
    });

    return { isFollowing: Boolean(existing) };
  }

  async followUser(
    followerId: string,
    username: string,
  ): Promise<{ isFollowing: boolean }> {
    const target = await this.userRepository.findOne({ where: { username } });
    if (!target) {
      throw new NotFoundException(`User with username "${username}" not found`);
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
        await manager.save(follow);
        await manager.increment(User, { id: followerId }, 'followingCount', 1);
        await manager.increment(User, { id: target.id }, 'followerCount', 1);
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
    username: string,
  ): Promise<{ isFollowing: boolean }> {
    const target = await this.userRepository.findOne({ where: { username } });
    if (!target) {
      throw new NotFoundException(`User with username "${username}" not found`);
    }

    const existing = await this.followRepository.findOne({
      where: { followerId, followingId: target.id },
    });

    if (!existing) {
      return { isFollowing: false };
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(Follow, { id: existing.id });
      await manager.decrement(User, { id: followerId }, 'followingCount', 1);
      await manager.decrement(User, { id: target.id }, 'followerCount', 1);
    });

    return { isFollowing: false };
  }
}
