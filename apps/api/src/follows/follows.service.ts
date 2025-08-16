import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Follows } from './entities/follows.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class FollowsService {
  constructor(
    @InjectRepository(Follows)
    private readonly followsRepository: Repository<Follows>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  private async ensureUsersExist(
    followerId: string,
    followingId: string,
  ): Promise<[User, User]> {
    const [follower, following] = await Promise.all([
      this.userRepository.findOne({ where: { id: followerId } }),
      this.userRepository.findOne({ where: { id: followingId } }),
    ]);
    if (!follower) throw new NotFoundException('Follower not found');
    if (!following) throw new NotFoundException('Target user not found');
    return [follower, following];
  }

  async followUser(followerId: string, followingId: string): Promise<void> {
    if (followerId === followingId) {
      throw new BadRequestException('Cannot follow yourself');
    }

    await this.ensureUsersExist(followerId, followingId);

    const existing = await this.followsRepository.findOne({
      where: { followerId, followingId },
    });
    if (existing) {
      throw new ConflictException('Already following');
    }

    await this.followsRepository.save({ followerId, followingId });

    // Update denormalized counts
    await this.userRepository.increment(
      { id: followingId },
      'followerCount',
      1,
    );
    await this.userRepository.increment(
      { id: followerId },
      'followingCount',
      1,
    );
  }

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    if (followerId === followingId) {
      throw new BadRequestException('Cannot unfollow yourself');
    }

    await this.ensureUsersExist(followerId, followingId);

    const existing = await this.followsRepository.findOne({
      where: { followerId, followingId },
    });
    if (!existing) {
      throw new NotFoundException('Follow relationship not found');
    }

    await this.followsRepository.delete({ followerId, followingId });

    // Update denormalized counts
    await this.userRepository.decrement(
      { id: followingId },
      'followerCount',
      1,
    );
    await this.userRepository.decrement(
      { id: followerId },
      'followingCount',
      1,
    );
  }

  async getFollowerCount(userId: string): Promise<number> {
    return this.followsRepository.count({ where: { followingId: userId } });
  }

  async getFollowingCount(userId: string): Promise<number> {
    return this.followsRepository.count({ where: { followerId: userId } });
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    if (!followerId || !followingId || followerId === followingId) {
      return false;
    }
    const existing = await this.followsRepository.findOne({
      where: { followerId, followingId },
    });
    return Boolean(existing);
  }
}
