import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Follows } from '../follows/entities/follows.entity';

export interface UserProfileDto {
  id: string;
  username: string;
  fullName: string;
  email: string;
  profilePictureUrl?: string;
  bio?: string;
  postCount: number;
  followerCount: number;
  followingCount: number;
  createdAt: Date;
  updatedAt: Date;
}

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

  async toUserProfileDto(user: User): Promise<UserProfileDto> {
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      profilePictureUrl: user.profilePictureUrl,
      bio: user.bio,
      postCount: user.postsCount,
      followerCount: user.followerCount,
      followingCount: user.followingCount,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async getUserProfile(username: string): Promise<UserProfileDto> {
    const user = await this.findByUsername(username);
    return this.toUserProfileDto(user);
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
  ): Promise<UserProfileDto> {
    const user = await this.findById(id);

    // Username uniqueness check (exclude current user)
    const usernameTaken = await this.isUsernameTaken(updates.username, id);
    if (usernameTaken) {
      throw new ConflictException('Username already taken');
    }

    user.fullName = updates.fullName;
    user.username = updates.username;

    const saved = await this.userRepository.save(user);
    return this.toUserProfileDto(saved);
  }

  async getFollowers(username: string, page = 1, limit = 20) {
    const user = await this.findByUsername(username);
    const [rows, total] = await this.followsRepository.findAndCount({
      where: { followingId: user.id },
      relations: ['follower'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return {
      users: rows.map((f) => ({
        id: f.follower.id,
        username: f.follower.username,
        fullName: f.follower.fullName,
        profilePictureUrl: f.follower.profilePictureUrl,
        isFollowing: false,
      })),
      pagination: {
        page,
        limit,
        total,
        hasMore: page * limit < total,
      },
    };
  }

  async getFollowing(username: string, page = 1, limit = 20) {
    const user = await this.findByUsername(username);
    const [rows, total] = await this.followsRepository.findAndCount({
      where: { followerId: user.id },
      relations: ['following'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return {
      users: rows.map((f) => ({
        id: f.following.id,
        username: f.following.username,
        fullName: f.following.fullName,
        profilePictureUrl: f.following.profilePictureUrl,
        isFollowing: true,
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
