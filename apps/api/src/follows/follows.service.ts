import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Follows } from './entities/follows.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class FollowsService {
  constructor(
    @InjectRepository(Follows)
    private readonly followsRepository: Repository<Follows>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  private async ensureUsersExistWith(
    userRepository: Repository<User>,
    followerId: string,
    followingId: string,
  ): Promise<[User, User]> {
    const [follower, following] = await Promise.all([
      userRepository.findOne({ where: { id: followerId } }),
      userRepository.findOne({ where: { id: followingId } }),
    ]);
    if (!follower) throw new NotFoundException('Follower not found');
    if (!following) throw new NotFoundException('Target user not found');
    return [follower, following];
  }

  async followUser(followerId: string, followingId: string): Promise<void> {
    if (followerId === followingId) {
      throw new BadRequestException('Cannot follow yourself');
    }

    await this.dataSource.transaction(async (manager) => {
      const followsRepo = manager.getRepository(Follows);
      const usersRepo = manager.getRepository(User);

      await this.ensureUsersExistWith(usersRepo, followerId, followingId);

      const insertResult = await followsRepo
        .createQueryBuilder()
        .insert()
        .into(Follows)
        .values({ followerId, followingId })
        .orIgnore()
        .execute();

      if (insertResult.identifiers.length === 0) {
        throw new ConflictException('Already following');
      }

      await usersRepo.increment({ id: followingId }, 'followerCount', 1);
      await usersRepo.increment({ id: followerId }, 'followingCount', 1);
    });
  }

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    if (followerId === followingId) {
      throw new BadRequestException('Cannot unfollow yourself');
    }

    await this.dataSource.transaction(async (manager) => {
      const followsRepo = manager.getRepository(Follows);
      const usersRepo = manager.getRepository(User);

      await this.ensureUsersExistWith(usersRepo, followerId, followingId);

      const deleted = await followsRepo.delete({ followerId, followingId });
      if (!deleted.affected) {
        throw new NotFoundException('Follow relationship not found');
      }

      await usersRepo.decrement({ id: followingId }, 'followerCount', 1);
      await usersRepo.decrement({ id: followerId }, 'followingCount', 1);
    });
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
