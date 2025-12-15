import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Follows } from '../follows/entities/follows.entity';
import { PublicUserProfileDto } from './dto/public-user-profile.dto';
import { MyProfileDto } from './dto/my-profile.dto';
import { FollowListResponseDto } from './dto/follow-list-response.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Follows)
    private readonly followsRepository: Repository<Follows>,
  ) {}

  async findByUsername(username: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { username },
    });

    if (!user) {
      throw new NotFoundException(`User with username "${username}" not found`);
    }

    return user;
  }

  async findByEmail(email: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException(`User with email "${email}" not found`);
    }
    return user;
  }

  async isUsernameTaken(
    username: string,
    excludeUserId?: string,
  ): Promise<boolean> {
    const existing = await this.userRepository.findOne({ where: { username } });
    if (!existing) return false;
    if (excludeUserId && existing.id === excludeUserId) return false;
    return true;
  }

  async toPublicUserProfileDto(user: User): Promise<PublicUserProfileDto> {
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      profilePictureUrl: user.profilePictureUrl ?? undefined,
      bio: user.bio ?? undefined,
      postCount: user.postsCount,
      followerCount: user.followerCount,
      followingCount: user.followingCount,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async toMyProfileDto(user: User): Promise<MyProfileDto> {
    return {
      ...(await this.toPublicUserProfileDto(user)),
      email: user.email,
    };
  }

  async getUserProfile(username: string): Promise<PublicUserProfileDto> {
    const user = await this.findByUsername(username);
    return this.toPublicUserProfileDto(user);
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    return user;
  }

  async updateProfile(
    id: string,
    updates: { fullName: string; username: string },
  ): Promise<MyProfileDto> {
    const user = await this.findById(id);

    // Username uniqueness check (exclude current user)
    const usernameTaken = await this.isUsernameTaken(updates.username, id);
    if (usernameTaken) {
      throw new ConflictException('Username already taken');
    }

    user.fullName = updates.fullName;
    user.username = updates.username;

    const saved = await this.userRepository.save(user);
    return this.toMyProfileDto(saved);
  }

  async getFollowers(
    username: string,
    page = 1,
    limit = 20,
    viewerUserId?: string,
  ): Promise<FollowListResponseDto> {
    const user = await this.findByUsername(username);
    const [rows, total] = await this.followsRepository.findAndCount({
      where: { followingId: user.id },
      relations: ['follower'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    const followerIds = rows.map((f) => f.follower.id);
    const viewerFollowingIds =
      viewerUserId && followerIds.length > 0
        ? new Set(
            (
              await this.followsRepository.find({
                where: {
                  followerId: viewerUserId,
                  followingId: In(followerIds),
                },
                select: ['followingId'],
              })
            ).map((rel) => rel.followingId),
          )
        : new Set<string>();

    return {
      users: rows.map((f) => ({
        id: f.follower.id,
        username: f.follower.username,
        fullName: f.follower.fullName,
        profilePictureUrl: f.follower.profilePictureUrl ?? undefined,
        isFollowing: viewerUserId
          ? viewerFollowingIds.has(f.follower.id)
          : false,
      })),
      pagination: {
        page,
        limit,
        total,
        hasMore: page * limit < total,
      },
    };
  }

  async getFollowing(
    username: string,
    page = 1,
    limit = 20,
    viewerUserId?: string,
  ): Promise<FollowListResponseDto> {
    const user = await this.findByUsername(username);
    const [rows, total] = await this.followsRepository.findAndCount({
      where: { followerId: user.id },
      relations: ['following'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    const followingIds = rows.map((f) => f.following.id);
    const viewerFollowingIds =
      viewerUserId && followingIds.length > 0
        ? new Set(
            (
              await this.followsRepository.find({
                where: {
                  followerId: viewerUserId,
                  followingId: In(followingIds),
                },
                select: ['followingId'],
              })
            ).map((rel) => rel.followingId),
          )
        : new Set<string>();

    return {
      users: rows.map((f) => ({
        id: f.following.id,
        username: f.following.username,
        fullName: f.following.fullName,
        profilePictureUrl: f.following.profilePictureUrl ?? undefined,
        isFollowing: viewerUserId
          ? viewerFollowingIds.has(f.following.id)
          : false,
      })),
      pagination: {
        page,
        limit,
        total,
        hasMore: page * limit < total,
      },
    };
  }
}
