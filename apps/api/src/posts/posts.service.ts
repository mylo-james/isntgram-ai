import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { Follow } from '../follows/entities/follow.entity';
import { User } from '../users/entities/user.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { FeedQueryDto } from './dto/feed-query.dto';
import { FeedResponseDto } from './dto/feed-response.dto';
import { PostAuthorDto, PostDto } from './dto/post.dto';
import { ConfigService } from '@nestjs/config';

const DEFAULT_FEED_LIMIT = 20;
const DEFAULT_MEDIA_HOSTS = [
  'cdn.isntgram.ai',
  'localhost:9000',
  '127.0.0.1:9000',
];

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  private shouldUseTransactionalWrites(): boolean {
    const options = this.dataSource.options as {
      type?: string;
      database?: string | undefined;
    };
    return !(options.type === 'sqlite' && options.database === ':memory:');
  }

  async createPost(authorId: string, dto: CreatePostDto): Promise<PostDto> {
    if (dto.mediaUrl && !this.isAllowedMediaUrl(dto.mediaUrl)) {
      throw new BadRequestException('Unsupported media host');
    }

    const created = this.shouldUseTransactionalWrites()
      ? await this.dataSource.transaction(async (manager) => {
          const postRepository = manager.getRepository(Post);
          const userRepository = manager.getRepository(User);

          const post = postRepository.create({
            authorId,
            content: dto.content,
            mediaUrl: dto.mediaUrl,
          });

          const saved = await postRepository.save(post);
          await userRepository.increment({ id: authorId }, 'postsCount', 1);

          return postRepository.findOne({
            where: { id: saved.id },
            relations: ['author'],
          });
        })
      : await (async () => {
          const post = this.postRepository.create({
            authorId,
            content: dto.content,
            mediaUrl: dto.mediaUrl,
          });
          const saved = await this.postRepository.save(post);
          await this.userRepository.increment(
            { id: authorId },
            'postsCount',
            1,
          );
          return this.postRepository.findOne({
            where: { id: saved.id },
            relations: ['author'],
          });
        })();

    if (!created) {
      throw new NotFoundException('Post not found after creation');
    }

    return this.toPostDto(created);
  }

  async getFeed(userId: string, query: FeedQueryDto): Promise<FeedResponseDto> {
    const limit = query.limit ?? DEFAULT_FEED_LIMIT;
    const followsSubquery = this.followRepository
      .createQueryBuilder('follow')
      .select('follow.followingId')
      .where('follow.followerId = :viewerId', { viewerId: userId });

    const qb = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .where(
        `post.authorId = :viewerId OR post.authorId IN (${followsSubquery.getQuery()})`,
        { viewerId: userId },
      )
      .orderBy('post.createdAt', 'DESC')
      .addOrderBy('post.id', 'DESC')
      .take(limit + 1);

    if (query.cursor) {
      const cursor = this.decodeCursor(query.cursor);
      const cursorCreatedAt = this.toCursorCreatedAtParam(cursor.createdAt);
      qb.andWhere(
        '(post.createdAt < :cursorCreatedAt OR (post.createdAt = :cursorCreatedAt AND post.id < :cursorId))',
        {
          cursorCreatedAt,
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
      const cursorCreatedAt = this.toCursorCreatedAtParam(cursor.createdAt);
      qb.andWhere(
        '(post.createdAt < :cursorCreatedAt OR (post.createdAt = :cursorCreatedAt AND post.id < :cursorId))',
        {
          cursorCreatedAt,
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

  private isAllowedMediaUrl(url: string): boolean {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return false;
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    const configuredHosts =
      this.configService.get<string>('MEDIA_ALLOWED_HOSTS') || '';
    const allowedHosts = configuredHosts
      .split(',')
      .map((host) => host.trim())
      .filter(Boolean);

    const publicBaseUrl = this.configService.get<string>('S3_PUBLIC_BASE_URL');
    let publicHost: string | undefined;
    if (publicBaseUrl) {
      try {
        publicHost = new URL(publicBaseUrl).host;
      } catch {
        publicHost = undefined;
      }
    }

    const mergedHosts = [
      ...(publicHost ? [publicHost] : []),
      ...(allowedHosts.length > 0 ? allowedHosts : DEFAULT_MEDIA_HOSTS),
    ];
    const finalHosts = Array.from(new Set(mergedHosts));
    return finalHosts.includes(parsed.host);
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

  private toCursorCreatedAtParam(createdAt: Date): Date | string {
    const dbType = this.dataSource?.options?.type;
    // SQLite stores CreateDateColumn with second precision by default; comparing against a value with
    // millisecond precision can cause cursor pagination to repeat items.
    if (dbType === 'sqlite' || dbType === 'better-sqlite3') {
      return createdAt.toISOString().slice(0, 19).replace('T', ' ');
    }
    return createdAt;
  }
}
