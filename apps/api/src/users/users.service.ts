import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { PublicUserProfileDto } from './dto/public-user-profile.dto';
import { PrivateUserProfileDto } from './dto/private-user-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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

  async isUsernameTaken(
    username: string,
    excludeUserId?: string,
  ): Promise<boolean> {
    const existing = await this.userRepository.findOne({ where: { username } });
    if (!existing) return false;
    if (excludeUserId && existing.id === excludeUserId) return false;
    return true;
  }

  toPublicProfileDto(user: User): PublicUserProfileDto {
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      profilePictureUrl: user.profilePictureUrl,
      bio: user.bio,
      postCount: user.postsCount,
      followerCount: user.followerCount,
      followingCount: user.followingCount,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  toPrivateProfileDto(user: User): PrivateUserProfileDto {
    return {
      ...this.toPublicProfileDto(user),
      email: user.email,
    };
  }

  async getPublicProfile(username: string): Promise<PublicUserProfileDto> {
    const user = await this.findByUsername(username);
    return this.toPublicProfileDto(user);
  }

  async getPrivateProfileById(id: string): Promise<PrivateUserProfileDto> {
    const user = await this.findById(id);
    return this.toPrivateProfileDto(user);
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
  ): Promise<PrivateUserProfileDto> {
    const user = await this.findById(id);

    // Username uniqueness check (exclude current user)
    const usernameTaken = await this.isUsernameTaken(updates.username, id);
    if (usernameTaken) {
      throw new ConflictException('Username already taken');
    }

    user.fullName = updates.fullName;
    user.username = updates.username;

    const saved = await this.userRepository.save(user);
    return this.toPrivateProfileDto(saved);
  }
}
