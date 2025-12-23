import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { Like } from './entities/like.entity';
import { Comment } from './entities/comment.entity';
import { CommentLike } from './entities/comment-like.entity';
import { Follow } from '../follows/entities/follow.entity';
import { User } from '../users/entities/user.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { FeedQueryDto } from './dto/feed-query.dto';
import { FeedResponseDto } from './dto/feed-response.dto';
import { PostDto } from './dto/post.dto';
import { PostAuthorDto } from './dto/post-author.dto';
import { ConfigService } from '@nestjs/config';
import { PostLikeStatusDto } from './dto/post-like-status.dto';
import { CommentLikeStatusDto } from './dto/comment-like-status.dto';
import { CommentsResponseDto } from './dto/comments-response.dto';
import { CommentDto } from './dto/comment.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { isUniqueConstraintError } from '../common/db-errors';

const DEFAULT_FEED_LIMIT = 20;
const DEFAULT_MEDIA_HOSTS = [
  'cdn.isntgram.ai',
  'localhost:9000',
  '127.0.0.1:9000',
  'picsum.photos',
];

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(Like)
    private readonly likeRepository: Repository<Like>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(CommentLike)
    private readonly commentLikeRepository: Repository<CommentLike>,
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

  private async getLikedPostIds(
    viewerId: string | null | undefined,
    postIds: string[],
  ): Promise<Set<string>> {
    if (!viewerId || postIds.length === 0) return new Set();

    const likes = await this.likeRepository.find({
      where: { userId: viewerId, postId: In(postIds) },
      select: ['postId'],
    });
    return new Set(likes.map((like) => like.postId));
  }

  private async getLikedCommentIds(
    viewerId: string | null | undefined,
    commentIds: string[],
  ): Promise<Set<string>> {
    if (!viewerId || commentIds.length === 0) return new Set();

    const likes = await this.commentLikeRepository.find({
      where: { userId: viewerId, commentId: In(commentIds) },
      select: ['commentId'],
    });
    return new Set(likes.map((like) => like.commentId));
  }

  private async getPreviewCommentsByPostId(
    postIds: string[],
    limitPerPost = 3,
  ): Promise<Map<string, Comment[]>> {
    const previews = new Map<string, Comment[]>();
    if (postIds.length === 0) return previews;
    if (!Number.isFinite(limitPerPost) || limitPerPost <= 0) return previews;

    const ranked = this.commentRepository
      .createQueryBuilder('c')
      .select('c.id', 'id')
      .addSelect(
        'ROW_NUMBER() OVER (PARTITION BY c.postId ORDER BY c.createdAt DESC, c.id DESC)',
        'rn',
      )
      .where('c.postId IN (:...postIds)', { postIds });

    const comments = await this.commentRepository
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.author', 'author')
      .innerJoin(`(${ranked.getQuery()})`, 'ranked', 'ranked.id = comment.id')
      .setParameters(ranked.getParameters())
      .where('ranked.rn <= :limitPerPost', { limitPerPost })
      .orderBy('comment.postId', 'ASC')
      .addOrderBy('comment.createdAt', 'DESC')
      .addOrderBy('comment.id', 'DESC')
      .getMany();

    for (const comment of comments) {
      const existing = previews.get(comment.postId);
      if (existing) {
        existing.push(comment);
      } else {
        previews.set(comment.postId, [comment]);
      }
    }

    return previews;
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

    return this.toPostDto(created, { previewComments: [] });
  }

  async getFeed(
    userId: string,
    viewerIsDemo: boolean,
    query: FeedQueryDto,
  ): Promise<FeedResponseDto> {
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
      .andWhere('author.isDemoUser = :viewerIsDemo', { viewerIsDemo })
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

    const likedPostIds = await this.getLikedPostIds(
      userId,
      items.map((post) => post.id),
    );
    const previewComments = await this.getPreviewCommentsByPostId(
      items.map((post) => post.id),
      3,
    );

    return {
      items: items.map((post) =>
        this.toPostDto(post, {
          likedByViewer: likedPostIds.has(post.id),
          previewComments: previewComments.get(post.id) ?? [],
        }),
      ),
      nextCursor,
    };
  }

  async getExplore(
    viewerId: string,
    viewerIsDemo: boolean,
    query: FeedQueryDto,
  ): Promise<FeedResponseDto> {
    const limit = query.limit ?? DEFAULT_FEED_LIMIT;

    const qb = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .where('author.isDemoUser = :viewerIsDemo', { viewerIsDemo })
      .andWhere('post.mediaUrl IS NOT NULL')
      .andWhere('post.authorId <> :viewerId', { viewerId })
      .orderBy('post.createdAt', 'DESC')
      .addOrderBy('post.id', 'DESC')
      .take(limit + 1);

    if (query.cursor) {
      const cursor = this.decodeCursor(query.cursor);
      const cursorCreatedAt = this.toCursorCreatedAtParam(cursor.createdAt);
      qb.andWhere(
        '(post.createdAt < :cursorCreatedAt OR (post.createdAt = :cursorCreatedAt AND post.id < :cursorId))',
        { cursorCreatedAt, cursorId: cursor.id },
      );
    }

    const results = await qb.getMany();
    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore
      ? this.encodeCursor(items[items.length - 1])
      : undefined;

    const likedPostIds = await this.getLikedPostIds(
      viewerId,
      items.map((post) => post.id),
    );

    return {
      items: items.map((post) =>
        this.toPostDto(post, {
          likedByViewer: likedPostIds.has(post.id),
          previewComments: [],
        }),
      ),
      nextCursor,
    };
  }

  async getUserPosts(
    username: string,
    viewer: { isDemoUser: boolean; userId?: string | null },
    query: FeedQueryDto,
  ): Promise<FeedResponseDto> {
    const normalizedUsername = username.trim().toLowerCase();
    const limit = query.limit ?? DEFAULT_FEED_LIMIT;
    const user = await this.userRepository.findOne({
      where: { username: normalizedUsername, isDemoUser: viewer.isDemoUser },
    });

    if (!user) {
      throw new NotFoundException(
        `User with username "${normalizedUsername}" not found`,
      );
    }

    const qb = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .where('post.authorId = :authorId', { authorId: user.id })
      .andWhere('author.isDemoUser = :viewerIsDemo', {
        viewerIsDemo: viewer.isDemoUser,
      })
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

    const likedPostIds = await this.getLikedPostIds(
      viewer.userId,
      items.map((post) => post.id),
    );
    const previewComments = await this.getPreviewCommentsByPostId(
      items.map((post) => post.id),
      3,
    );

    return {
      items: items.map((post) =>
        this.toPostDto(post, {
          likedByViewer: likedPostIds.has(post.id),
          previewComments: previewComments.get(post.id) ?? [],
        }),
      ),
      nextCursor,
    };
  }

  private toPostDto(
    post: Post,
    options?: { likedByViewer?: boolean; previewComments?: Comment[] },
  ): PostDto {
    return {
      id: post.id,
      content: post.content,
      mediaUrl: post.mediaUrl,
      likeCount: post.likeCount ?? 0,
      commentCount: post.commentCount ?? 0,
      previewComments: (options?.previewComments ?? []).map((comment) =>
        this.toCommentDto(comment),
      ),
      likedByViewer: options?.likedByViewer ?? false,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      author: this.toAuthorDto(post.author),
    };
  }

  async getPost(
    postId: string,
    viewer: { isDemoUser: boolean; userId?: string | null },
  ): Promise<PostDto> {
    const post = await this.getPostForViewer(postId, viewer.isDemoUser);
    const likedPostIds = await this.getLikedPostIds(viewer.userId, [postId]);
    const previewComments = await this.getPreviewCommentsByPostId([postId], 3);

    return this.toPostDto(post, {
      likedByViewer: likedPostIds.has(postId),
      previewComments: previewComments.get(postId) ?? [],
    });
  }

  private toAuthorDto(user: User): PostAuthorDto {
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      profilePictureUrl: user.profilePictureUrl,
    };
  }

  private async getPostForViewer(
    postId: string,
    viewerIsDemo: boolean,
  ): Promise<Post> {
    const post = await this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .where('post.id = :postId', { postId })
      .andWhere('author.isDemoUser = :viewerIsDemo', { viewerIsDemo })
      .getOne();

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return post;
  }

  private async getPostCounts(
    postId: string,
  ): Promise<{ likeCount: number; commentCount: number } | null> {
    const post = await this.postRepository.findOne({
      where: { id: postId },
      select: ['id', 'likeCount', 'commentCount'] as Array<
        keyof Pick<Post, 'id' | 'likeCount' | 'commentCount'>
      >,
    });
    if (!post) return null;
    return {
      likeCount: post.likeCount ?? 0,
      commentCount: post.commentCount ?? 0,
    };
  }

  async likePost(
    userId: string,
    viewerIsDemo: boolean,
    postId: string,
  ): Promise<PostLikeStatusDto> {
    const post = await this.getPostForViewer(postId, viewerIsDemo);

    const existing = await this.likeRepository.findOne({
      where: { postId, userId },
    });
    if (existing) {
      return { isLiked: true, likeCount: post.likeCount ?? 0 };
    }

    try {
      await (this.shouldUseTransactionalWrites()
        ? this.dataSource.transaction(async (manager) => {
            const likeRepository = manager.getRepository(Like);
            const postRepository = manager.getRepository(Post);

            await likeRepository.save(
              likeRepository.create({ postId, userId }),
            );
            await postRepository.increment({ id: postId }, 'likeCount', 1);
          })
        : (async () => {
            await this.likeRepository.save(
              this.likeRepository.create({ postId, userId }),
            );
            await this.postRepository.increment({ id: postId }, 'likeCount', 1);
          })());
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const counts = await this.getPostCounts(postId);
        return { isLiked: true, likeCount: counts?.likeCount ?? 0 };
      }
      throw error;
    }

    const counts = await this.getPostCounts(postId);
    return {
      isLiked: true,
      likeCount: counts?.likeCount ?? post.likeCount + 1,
    };
  }

  async unlikePost(
    userId: string,
    viewerIsDemo: boolean,
    postId: string,
  ): Promise<PostLikeStatusDto> {
    const post = await this.getPostForViewer(postId, viewerIsDemo);

    const existing = await this.likeRepository.findOne({
      where: { postId, userId },
    });
    if (!existing) {
      return { isLiked: false, likeCount: post.likeCount ?? 0 };
    }

    await (this.shouldUseTransactionalWrites()
      ? this.dataSource.transaction(async (manager) => {
          const likeRepository = manager.getRepository(Like);
          const postRepository = manager.getRepository(Post);
          await likeRepository.delete({ id: existing.id });
          await postRepository.decrement({ id: postId }, 'likeCount', 1);
        })
      : (async () => {
          await this.likeRepository.delete({ id: existing.id });
          await this.postRepository.decrement({ id: postId }, 'likeCount', 1);
        })());

    const counts = await this.getPostCounts(postId);
    return {
      isLiked: false,
      likeCount: counts?.likeCount ?? Math.max((post.likeCount ?? 0) - 1, 0),
    };
  }

  private async getCommentLikeCount(commentId: string): Promise<number | null> {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
      select: ['id', 'likeCount'] as Array<
        keyof Pick<Comment, 'id' | 'likeCount'>
      >,
    });
    if (!comment) return null;
    return comment.likeCount ?? 0;
  }

  async likeComment(
    userId: string,
    viewerIsDemo: boolean,
    postId: string,
    commentId: string,
  ): Promise<CommentLikeStatusDto> {
    await this.getPostForViewer(postId, viewerIsDemo);

    const comment = await this.commentRepository.findOne({
      where: { id: commentId, postId },
      select: ['id', 'likeCount'] as Array<
        keyof Pick<Comment, 'id' | 'likeCount'>
      >,
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const existing = await this.commentLikeRepository.findOne({
      where: { commentId, userId },
    });
    if (existing) {
      return { isLiked: true, likeCount: comment.likeCount ?? 0 };
    }

    try {
      await (this.shouldUseTransactionalWrites()
        ? this.dataSource.transaction(async (manager) => {
            const likeRepository = manager.getRepository(CommentLike);
            const commentRepository = manager.getRepository(Comment);
            await likeRepository.save(
              likeRepository.create({ commentId, userId }),
            );
            await commentRepository.increment(
              { id: commentId },
              'likeCount',
              1,
            );
          })
        : (async () => {
            await this.commentLikeRepository.save(
              this.commentLikeRepository.create({ commentId, userId }),
            );
            await this.commentRepository.increment(
              { id: commentId },
              'likeCount',
              1,
            );
          })());
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const likeCount = await this.getCommentLikeCount(commentId);
        return { isLiked: true, likeCount: likeCount ?? 0 };
      }
      throw error;
    }

    const likeCount = await this.getCommentLikeCount(commentId);
    return {
      isLiked: true,
      likeCount: likeCount ?? (comment.likeCount ?? 0) + 1,
    };
  }

  async unlikeComment(
    userId: string,
    viewerIsDemo: boolean,
    postId: string,
    commentId: string,
  ): Promise<CommentLikeStatusDto> {
    await this.getPostForViewer(postId, viewerIsDemo);

    const comment = await this.commentRepository.findOne({
      where: { id: commentId, postId },
      select: ['id', 'likeCount'] as Array<
        keyof Pick<Comment, 'id' | 'likeCount'>
      >,
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const existing = await this.commentLikeRepository.findOne({
      where: { commentId, userId },
    });
    if (!existing) {
      return { isLiked: false, likeCount: comment.likeCount ?? 0 };
    }

    await (this.shouldUseTransactionalWrites()
      ? this.dataSource.transaction(async (manager) => {
          const likeRepository = manager.getRepository(CommentLike);
          const commentRepository = manager.getRepository(Comment);
          await likeRepository.delete({ id: existing.id });
          await commentRepository.decrement({ id: commentId }, 'likeCount', 1);
        })
      : (async () => {
          await this.commentLikeRepository.delete({ id: existing.id });
          await this.commentRepository.decrement(
            { id: commentId },
            'likeCount',
            1,
          );
        })());

    const likeCount = await this.getCommentLikeCount(commentId);
    return {
      isLiked: false,
      likeCount: likeCount ?? Math.max((comment.likeCount ?? 0) - 1, 0),
    };
  }

  async getComments(
    postId: string,
    viewer: { isDemoUser: boolean; userId?: string | null },
    query: FeedQueryDto,
  ): Promise<CommentsResponseDto> {
    await this.getPostForViewer(postId, viewer.isDemoUser);

    const limit = query.limit ?? DEFAULT_FEED_LIMIT;
    const qb = this.commentRepository
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.author', 'author')
      .where('comment.postId = :postId', { postId })
      .orderBy('comment.createdAt', 'DESC')
      .addOrderBy('comment.id', 'DESC')
      .take(limit + 1);

    if (query.cursor) {
      const cursor = this.decodeCursor(query.cursor);
      const cursorCreatedAt = this.toCursorCreatedAtParam(cursor.createdAt);
      qb.andWhere(
        '(comment.createdAt < :cursorCreatedAt OR (comment.createdAt = :cursorCreatedAt AND comment.id < :cursorId))',
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

    const likedCommentIds = await this.getLikedCommentIds(
      viewer.userId,
      items.map((comment) => comment.id),
    );

    return {
      items: items.map((comment) =>
        this.toCommentDto(comment, {
          likedByViewer: likedCommentIds.has(comment.id),
        }),
      ),
      nextCursor,
    };
  }

  async createComment(
    userId: string,
    viewerIsDemo: boolean,
    postId: string,
    dto: CreateCommentDto,
  ): Promise<CommentDto> {
    await this.getPostForViewer(postId, viewerIsDemo);

    const created = this.shouldUseTransactionalWrites()
      ? await this.dataSource.transaction(async (manager) => {
          const commentRepository = manager.getRepository(Comment);
          const postRepository = manager.getRepository(Post);

          const comment = commentRepository.create({
            postId,
            authorId: userId,
            content: dto.content,
          });

          const saved = await commentRepository.save(comment);
          await postRepository.increment({ id: postId }, 'commentCount', 1);

          return commentRepository.findOne({
            where: { id: saved.id },
            relations: ['author'],
          });
        })
      : await (async () => {
          const comment = this.commentRepository.create({
            postId,
            authorId: userId,
            content: dto.content,
          });
          const saved = await this.commentRepository.save(comment);
          await this.postRepository.increment(
            { id: postId },
            'commentCount',
            1,
          );
          return this.commentRepository.findOne({
            where: { id: saved.id },
            relations: ['author'],
          });
        })();

    if (!created) {
      throw new NotFoundException('Comment not found after creation');
    }

    return this.toCommentDto(created, { likedByViewer: false });
  }

  private toCommentDto(
    comment: Comment,
    options?: { likedByViewer?: boolean },
  ): CommentDto {
    return {
      id: comment.id,
      postId: comment.postId,
      content: comment.content,
      likeCount: comment.likeCount ?? 0,
      likedByViewer: options?.likedByViewer ?? false,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      author: this.toAuthorDto(comment.author),
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

  private encodeCursor(entity: { createdAt: Date; id: string }): string {
    // base64url avoids `+` and `/` in query params while staying opaque.
    return Buffer.from(
      `${entity.createdAt.toISOString()}|${entity.id}`,
    ).toString('base64url');
  }

  private decodeCursor(cursor: string): { createdAt: Date; id: string } {
    let decoded: string;
    try {
      // Accept base64url (current) and base64 (legacy) cursors.
      decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    } catch {
      try {
        decoded = Buffer.from(cursor, 'base64').toString('utf8');
      } catch {
        throw new BadRequestException('Invalid cursor');
      }
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
