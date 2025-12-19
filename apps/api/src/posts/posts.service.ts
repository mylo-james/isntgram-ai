import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { Follow } from '../follows/entities/follow.entity';
import { User } from '../users/entities/user.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { FeedQueryDto } from './dto/feed-query.dto';
import { FeedResponseDto } from './dto/feed-response.dto';
import { PostAuthorDto, PostDto } from './dto/post.dto';

const DEFAULT_FEED_LIMIT = 20;

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async createPost(authorId: string, dto: CreatePostDto): Promise<PostDto> {
    const post = this.postRepository.create({
      authorId,
      content: dto.content,
      mediaUrl: dto.mediaUrl,
    });

    const saved = await this.postRepository.save(post);
    await this.userRepository.increment({ id: authorId }, 'postsCount', 1);

    const created = await this.postRepository.findOne({
      where: { id: saved.id },
      relations: ['author'],
    });

    if (!created) {
      throw new NotFoundException('Post not found after creation');
    }

    return this.toPostDto(created);
  }

  async getFeed(userId: string, query: FeedQueryDto): Promise<FeedResponseDto> {
    const limit = query.limit ?? DEFAULT_FEED_LIMIT;
    const authorIds = await this.getAuthorIdsForFeed(userId);

    const qb = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .where('post.authorId IN (:...authorIds)', { authorIds })
      .orderBy('post.createdAt', 'DESC')
      .addOrderBy('post.id', 'DESC')
      .take(limit + 1);

    if (query.cursor) {
      const cursor = this.decodeCursor(query.cursor);
      qb.andWhere(
        '(post.createdAt < :cursorCreatedAt OR (post.createdAt = :cursorCreatedAt AND post.id < :cursorId))',
        {
          cursorCreatedAt: cursor.createdAt,
          cursorId: cursor.id,
        },
      );
    }

    const results = await qb.getMany();
    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore
      ? this.encodeCursor(items[items.length - 1])
      : undefined;

    return {
      items: items.map((post) => this.toPostDto(post)),
      nextCursor,
    };
  }

  async getUserPosts(
    username: string,
    query: FeedQueryDto,
  ): Promise<FeedResponseDto> {
    const limit = query.limit ?? DEFAULT_FEED_LIMIT;
    const user = await this.userRepository.findOne({ where: { username } });

    if (!user) {
      throw new NotFoundException(`User with username "${username}" not found`);
    }

    const qb = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .where('post.authorId = :authorId', { authorId: user.id })
      .orderBy('post.createdAt', 'DESC')
      .addOrderBy('post.id', 'DESC')
      .take(limit + 1);

    if (query.cursor) {
      const cursor = this.decodeCursor(query.cursor);
      qb.andWhere(
        '(post.createdAt < :cursorCreatedAt OR (post.createdAt = :cursorCreatedAt AND post.id < :cursorId))',
        {
          cursorCreatedAt: cursor.createdAt,
          cursorId: cursor.id,
        },
      );
    }

    const results = await qb.getMany();
    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore
      ? this.encodeCursor(items[items.length - 1])
      : undefined;

    return {
      items: items.map((post) => this.toPostDto(post)),
      nextCursor,
    };
  }

  private async getAuthorIdsForFeed(userId: string): Promise<string[]> {
    const follows = await this.followRepository.find({
      where: { followerId: userId },
      select: ['followingId'],
    });
    const uniqueIds = new Set<string>([
      userId,
      ...follows.map((f) => f.followingId),
    ]);
    return Array.from(uniqueIds);
  }

  private toPostDto(post: Post): PostDto {
    return {
      id: post.id,
      content: post.content,
      mediaUrl: post.mediaUrl,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      author: this.toAuthorDto(post.author),
    };
  }

  private toAuthorDto(user: User): PostAuthorDto {
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      profilePictureUrl: user.profilePictureUrl,
    };
  }

  private encodeCursor(post: Post): string {
    return Buffer.from(`${post.createdAt.toISOString()}|${post.id}`).toString(
      'base64',
    );
  }

  private decodeCursor(cursor: string): { createdAt: Date; id: string } {
    let decoded: string;
    try {
      decoded = Buffer.from(cursor, 'base64').toString('utf8');
    } catch {
      throw new BadRequestException('Invalid cursor');
    }

    const [timestamp, id] = decoded.split('|');
    if (!timestamp || !id) {
      throw new BadRequestException('Invalid cursor');
    }

    const createdAt = new Date(timestamp);
    if (Number.isNaN(createdAt.getTime())) {
      throw new BadRequestException('Invalid cursor');
    }

    return { createdAt, id };
  }
}
