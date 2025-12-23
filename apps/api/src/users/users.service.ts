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
import { isUniqueConstraintError } from '../common/db-errors';
import { UserSearchQueryDto } from './dto/user-search-query.dto';
import { UserSearchItemDto } from './dto/user-search-item.dto';
import { UserSearchResponseDto } from './dto/user-search-response.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  private normalizeUsername(value: string): string {
    return value.trim().toLowerCase();
  }

  private normalizeFullName(value: string): string {
    return value.trim();
  }

  async findByUsername(username: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { username: this.normalizeUsername(username) },
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
    const existing = await this.userRepository.findOne({
      where: { username: this.normalizeUsername(username) },
    });
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

  async getPublicProfile(
    username: string,
    viewerIsDemo = false,
  ): Promise<PublicUserProfileDto> {
    const normalizedUsername = this.normalizeUsername(username);
    const user = await this.userRepository.findOne({
      where: { username: normalizedUsername, isDemoUser: viewerIsDemo },
    });
    if (!user) {
      throw new NotFoundException(
        `User with username "${normalizedUsername}" not found`,
      );
    }
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

    const nextUsername = this.normalizeUsername(updates.username);
    const nextFullName = this.normalizeFullName(updates.fullName);

    // Username uniqueness check (exclude current user)
    const usernameTaken = await this.isUsernameTaken(nextUsername, id);
    if (usernameTaken) {
      throw new ConflictException('Username already taken');
    }

    user.fullName = nextFullName;
    user.username = nextUsername;

    try {
      const saved = await this.userRepository.save(user);
      return this.toPrivateProfileDto(saved);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Username already taken');
      }
      throw error;
    }
  }

  async searchUsers(
    viewerIsDemo: boolean,
    query: UserSearchQueryDto,
  ): Promise<UserSearchResponseDto> {
    const raw = (query.q ?? '').trim();
    if (raw.length === 0) return { items: [] };

    const limit = query.limit ?? 10;
    const needle = `%${raw.toLowerCase()}%`;

    const qb = this.userRepository
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.username',
        'user.fullName',
        'user.profilePictureUrl',
      ])
      .where('user.isDemoUser = :viewerIsDemo', { viewerIsDemo })
      .andWhere(
        '(LOWER(user.username) LIKE :needle OR LOWER(user.fullName) LIKE :needle)',
        { needle },
      )
      .orderBy('user.username', 'ASC')
      .take(limit);

    const results = await qb.getMany();

    const items: UserSearchItemDto[] = results.map((user) => ({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      profilePictureUrl: user.profilePictureUrl,
    }));

    return { items };
  }
}
