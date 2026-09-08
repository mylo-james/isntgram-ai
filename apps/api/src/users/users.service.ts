import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, MoreThan, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { MediaUpload } from '../media/entities/media-upload.entity';
import { MediaService, PreparedMedia } from '../media/media.service';
import { PublicUserProfileDto } from './dto/public-user-profile.dto';
import { PrivateUserProfileDto } from './dto/private-user-profile.dto';
import { isUniqueConstraintError } from '../common/db-errors';
import { UserSearchQueryDto } from './dto/user-search-query.dto';
import { UserSearchItemDto } from './dto/user-search-item.dto';
import { UserSearchResponseDto } from './dto/user-search-response.dto';
import {
  isReservedUsername,
  normalizeUsername,
} from '@isntgram-ai/shared-types';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly mediaService: MediaService,
  ) {}

  private normalizeFullName(value: string): string {
    return value.trim();
  }

  async findByUsername(username: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { username: normalizeUsername(username) },
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
    const normalizedUsername = normalizeUsername(username);
    if (isReservedUsername(normalizedUsername)) return true;

    const existing = await this.userRepository.findOne({
      where: { username: normalizedUsername },
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
      profilePictureUrl: this.mediaService.toDisplayUrl(user.profilePictureUrl),
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
    const normalizedUsername = normalizeUsername(username);
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
    updates: {
      fullName: string;
      username: string;
      profilePictureUploadId?: string;
    },
  ): Promise<PrivateUserProfileDto> {
    const nextUsername = normalizeUsername(updates.username);
    const nextFullName = this.normalizeFullName(updates.fullName);

    if (isReservedUsername(nextUsername)) {
      throw new ConflictException('Username is reserved');
    }

    const user = await this.findById(id);

    // Username uniqueness check (exclude current user)
    const usernameTaken = await this.isUsernameTaken(nextUsername, id);
    if (usernameTaken) {
      throw new ConflictException('Username already taken');
    }

    let prepared: PreparedMedia | undefined;
    if (updates.profilePictureUploadId) {
      const existing = await this.mediaService.getOwnedUpload(
        id,
        updates.profilePictureUploadId,
      );
      const replayUrl = this.mediaService.getPublishedUrl(existing);
      if (existing.profilePictureUserId) {
        if (
          existing.profilePictureUserId !== id ||
          !replayUrl ||
          user.profilePictureUrl !== replayUrl
        ) {
          throw new ConflictException('Media upload is already in use');
        }
      } else {
        prepared = await this.mediaService.preparePublication(
          id,
          updates.profilePictureUploadId,
        );
      }
    }

    user.fullName = nextFullName;
    user.username = nextUsername;

    try {
      if (prepared) {
        const saved = await this.dataSource.transaction(async (manager) => {
          const users = manager.getRepository(User);
          const uploads = manager.getRepository(MediaUpload);
          user.profilePictureUrl = prepared.publishedUrl;
          const savedUser = await users.save(user);
          const claim = await uploads.update(
            {
              id: prepared.uploadId,
              ownerId: id,
              postId: IsNull(),
              profilePictureUserId: IsNull(),
              expiresAt: MoreThan(new Date()),
            },
            {
              profilePictureUserId: id,
              publishedKey: prepared.publishedKey,
              publishedChecksum: prepared.checksum,
              publishedContentType: prepared.contentType,
              publishedBytes: prepared.bytes,
            },
          );
          if (claim.affected !== 1) {
            throw new ConflictException(
              'Media upload is no longer available. Select the photo again.',
            );
          }
          return savedUser;
        });
        return this.toPrivateProfileDto(saved);
      }
      const saved = await this.userRepository.save(user);
      return this.toPrivateProfileDto(saved);
    } catch (error) {
      if (prepared) {
        this.mediaService.recordOrphan(prepared, 'profile_transaction_failed');
      }
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
