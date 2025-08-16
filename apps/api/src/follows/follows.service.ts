import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Follow } from './entities/follows.entity';
import { User } from '../users/entities/user.entity';
import { FollowDto, FollowResponseDto, FollowStatsDto } from './dto/follow.dto';

@Injectable()
export class FollowsService {
  constructor(
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async followUser(
    followerId: string,
    followDto: FollowDto,
  ): Promise<FollowResponseDto> {
    const { userId: followingId } = followDto;

    // Prevent self-following
    if (followerId === followingId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    // Check if target user exists
    const targetUser = await this.userRepository.findOne({
      where: { id: followingId },
    });
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    // Check if already following
    const existingFollow = await this.followRepository.findOne({
      where: { followerId, followingId },
    });
    if (existingFollow) {
      throw new ConflictException('You are already following this user');
    }

    // Create follow relationship
    const follow = this.followRepository.create({
      followerId,
      followingId,
    });

    const savedFollow = await this.followRepository.save(follow);

    // Update user counts
    await this.updateFollowCounts(followerId, followingId, 'increment');

    return {
      id: savedFollow.id,
      followerId: savedFollow.followerId,
      followingId: savedFollow.followingId,
      createdAt: savedFollow.createdAt,
    };
  }

  async unfollowUser(
    followerId: string,
    followDto: FollowDto,
  ): Promise<{ message: string }> {
    const { userId: followingId } = followDto;

    // Check if follow relationship exists
    const follow = await this.followRepository.findOne({
      where: { followerId, followingId },
    });
    if (!follow) {
      throw new NotFoundException('You are not following this user');
    }

    // Remove follow relationship
    await this.followRepository.remove(follow);

    // Update user counts
    await this.updateFollowCounts(followerId, followingId, 'decrement');

    return { message: 'Successfully unfollowed user' };
  }

  async getFollowStats(
    userId: string,
    targetUserId: string,
  ): Promise<FollowStatsDto> {
    // Get follower and following counts for target user
    const [followerCount, followingCount] = await Promise.all([
      this.followRepository.count({ where: { followingId: targetUserId } }),
      this.followRepository.count({ where: { followerId: targetUserId } }),
    ]);

    // Check if current user is following target user
    let isFollowing = false;
    if (userId !== targetUserId) {
      const followRelation = await this.followRepository.findOne({
        where: { followerId: userId, followingId: targetUserId },
      });
      isFollowing = !!followRelation;
    }

    return {
      followerCount,
      followingCount,
      isFollowing,
    };
  }

  async getFollowers(userId: string): Promise<User[]> {
    const follows = await this.followRepository.find({
      where: { followingId: userId },
      relations: ['follower'],
    });

    return follows.map((follow) => follow.follower);
  }

  async getFollowing(userId: string): Promise<User[]> {
    const follows = await this.followRepository.find({
      where: { followerId: userId },
      relations: ['following'],
    });

    return follows.map((follow) => follow.following);
  }

  private async updateFollowCounts(
    followerId: string,
    followingId: string,
    operation: 'increment' | 'decrement',
  ): Promise<void> {
    const delta = operation === 'increment' ? 1 : -1;

    // Update follower's following count
    await this.userRepository.increment(
      { id: followerId },
      'followingCount',
      delta,
    );

    // Update following user's follower count
    await this.userRepository.increment(
      { id: followingId },
      'followerCount',
      delta,
    );
  }
}