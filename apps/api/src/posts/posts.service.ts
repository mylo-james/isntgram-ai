import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, MoreThan, Repository } from 'typeorm';
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
import { MediaService, PreparedMedia } from '../media/media.service';
import { MediaUpload } from '../media/entities/media-upload.entity';
import { PostLikeStatusDto } from './dto/post-like-status.dto';
import { CommentLikeStatusDto } from './dto/comment-like-status.dto';
import { CommentsResponseDto } from './dto/comments-response.dto';
import { CommentDto } from './dto/comment.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { isUniqueConstraintError } from '../common/db-errors';
import { NotificationsWriter } from '../notifications/notifications.writer';

const DEFAULT_FEED_LIMIT = 20;
class MediaClaimLost extends Error {}

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
    private readonly mediaService: MediaService,
    private readonly notificationsWriter: NotificationsWriter,
  ) {}

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
    return this.publishPost(authorId, dto);
  }

  // This seam is used only by the local fixture command, never an HTTP DTO.
  async createFixturePost(
    authorId: string,
    dto: CreatePostDto,
    postId: string,
  ): Promise<PostDto> {
    if (
      !/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
        postId,
      )
    )
      throw new BadRequestException('Invalid fixture identity');
    return this.publishPost(authorId, dto, postId);
  }

  private async publishPost(
    authorId: string,
    dto: CreatePostDto,
    fixturePostId?: string,
  ): Promise<PostDto> {
    if (dto.mediaUrl !== undefined && dto.mediaUrl !== null) {
      throw new BadRequestException('Use a verified upload to attach a photo');
    }

    const mediaAltText = dto.mediaAltText?.trim() || undefined;
    if (mediaAltText && !dto.mediaUploadId)
      throw new BadRequestException(
        'A photo description requires a photo upload',
      );
    let prepared: PreparedMedia | undefined;
    if (dto.mediaUploadId) {
      const replay = await this.getMediaReplay(
        authorId,
        dto.mediaUploadId,
        dto.content,
        mediaAltText,
      );
      if (replay) {
        if (fixturePostId && replay.id !== fixturePostId)
          throw new ConflictException('Fixture media identity differs');
        return replay;
      }
      try {
        prepared = await this.mediaService.preparePublication(
          authorId,
          dto.mediaUploadId,
        );
      } catch (error) {
        // A concurrent request may bind the intent between our lookup and preparation.
        if (error instanceof ConflictException) {
          const replay = await this.getMediaReplay(
            authorId,
            dto.mediaUploadId,
            dto.content,
            mediaAltText,
          );
          if (replay) {
            if (fixturePostId && replay.id !== fixturePostId)
              throw new ConflictException('Fixture media identity differs');
            return replay;
          }
        }
        throw error;
      }
    }

    try {
      const created = await this.dataSource.transaction(async (manager) => {
        const posts = manager.getRepository(Post);
        const users = manager.getRepository(User);
        const candidate = posts.create({
          ...(fixturePostId ? { id: fixturePostId } : {}),
          authorId,
          content: dto.content,
          mediaAltText,
          mediaUrl: prepared?.publishedUrl,
        });
        // INSERT refuses a fixed-ID collision. save() would update that row.
        const saved = fixturePostId
          ? (await posts.insert(candidate), candidate)
          : await posts.save(candidate);
        if (prepared) {
          const claim = await manager.getRepository(MediaUpload).update(
            {
              id: prepared.uploadId,
              ownerId: authorId,
              postId: IsNull(),
              profilePictureUserId: IsNull(),
              expiresAt: MoreThan(new Date()),
            },
            {
              postId: saved.id,
              publishedKey: prepared.publishedKey,
              publishedChecksum: prepared.checksum,
              publishedContentType: prepared.contentType,
              publishedBytes: prepared.bytes,
            },
          );
          if (claim.affected !== 1) throw new MediaClaimLost();
        }
        await users.increment({ id: authorId }, 'postsCount', 1);
        const loaded = await posts.findOne({
          where: { id: saved.id },
          relations: ['author'],
        });
        if (!loaded)
          throw new NotFoundException('Post not found after creation');
        return loaded;
      });
      // The durable claim is committed before the reservation can be consumed.
      // A process crash between these calls leaves a conservative reservation
      // for maintenance reconciliation rather than accepting extra uploads.
      if (prepared) {
        await this.mediaService.completeUploadReservation(
          authorId,
          prepared.uploadId,
        );
      }
      return this.toPostDto(created, { previewComments: [] });
    } catch (error) {
      if (prepared)
        await this.mediaService.recordOrphan(prepared, 'post_transaction_failed');
      if (error instanceof MediaClaimLost && dto.mediaUploadId) {
        const replay = await this.getMediaReplay(
          authorId,
          dto.mediaUploadId,
          dto.content,
          mediaAltText,
        );
        if (replay) {
          if (fixturePostId && replay.id !== fixturePostId)
            throw new ConflictException('Fixture media identity differs');
          return replay;
        }
        throw new ConflictException(
          'Media upload is no longer available. Select the photo again.',
        );
      }
      throw error;
    }
  }

  private async getMediaReplay(
    ownerId: string,
    uploadId: string,
    content: string,
    mediaAltText?: string,
  ): Promise<PostDto | undefined> {
    const upload = await this.mediaService.getOwnedUpload(ownerId, uploadId);
    if (!upload.postId) return undefined;
    const post = await this.postRepository.findOne({
      where: { id: upload.postId, authorId: ownerId },
      relations: ['author'],
    });
    if (
      !post ||
      post.content !== content ||
      (post.mediaAltText?.trim() || undefined) !== mediaAltText
    ) {
      throw new ConflictException(
        'Media upload is already attached to another post',
      );
    }
    return this.toPostDto(post, { previewComments: [] });
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
        `(post.authorId = :viewerId OR post.authorId IN (${followsSubquery.getQuery()}) OR (:includeDemoSeeds = true AND author.isDemoSeed = true))`,
        {
          viewerId: userId,
          includeDemoSeeds:
            viewerIsDemo && process.env.DEMO_CONTENT_SOURCE === 'curated',
        },
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
    const likedPreviewCommentIds = await this.getLikedCommentIds(
      userId,
      Array.from(previewComments.values()).flatMap((comments) =>
        comments.map((comment) => comment.id),
      ),
    );

    return {
      items: items.map((post) =>
        this.toPostDto(post, {
          likedByViewer: likedPostIds.has(post.id),
          previewComments: previewComments.get(post.id) ?? [],
          likedPreviewCommentIds,
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
    const likedPreviewCommentIds = await this.getLikedCommentIds(
      viewer.userId,
      Array.from(previewComments.values()).flatMap((comments) =>
        comments.map((comment) => comment.id),
      ),
    );

    return {
      items: items.map((post) =>
        this.toPostDto(post, {
          likedByViewer: likedPostIds.has(post.id),
          previewComments: previewComments.get(post.id) ?? [],
          likedPreviewCommentIds,
        }),
      ),
      nextCursor,
    };
  }

  private toPostDto(
    post: Post,
    options?: {
      likedByViewer?: boolean;
      previewComments?: Comment[];
      likedPreviewCommentIds?: ReadonlySet<string>;
    },
  ): PostDto {
    return {
      id: post.id,
      content: post.content,
      mediaAltText: post.mediaAltText || undefined,
      mediaUrl: this.mediaService.toDisplayUrl(post.mediaUrl),
      likeCount: post.likeCount ?? 0,
      commentCount: post.commentCount ?? 0,
      previewComments: (options?.previewComments ?? []).map((comment) =>
        this.toCommentDto(comment, {
          likedByViewer: options?.likedPreviewCommentIds?.has(comment.id),
        }),
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
    const postPreviewComments = previewComments.get(postId) ?? [];
    const likedPreviewCommentIds = await this.getLikedCommentIds(
      viewer.userId,
      postPreviewComments.map((comment) => comment.id),
    );

    return this.toPostDto(post, {
      likedByViewer: likedPostIds.has(postId),
      previewComments: postPreviewComments,
      likedPreviewCommentIds,
    });
  }

  private toAuthorDto(user: User): PostAuthorDto {
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      profilePictureUrl: this.mediaService.toDisplayUrl(user.profilePictureUrl),
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
      await this.dataSource.transaction(async (manager) => {
        const likeRepository = manager.getRepository(Like);
        const postRepository = manager.getRepository(Post);

        const like = await likeRepository.save(
          likeRepository.create({ postId, userId }),
        );
        await postRepository.increment({ id: postId }, 'likeCount', 1);
        await this.notificationsWriter.write(manager, {
          recipientId: post.authorId,
          actorId: userId,
          type: 'like',
          sourceId: like.id,
          postId,
        });
      });
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

    const likeCount = await this.dataSource.transaction(async (manager) => {
      const likeRepository = manager.getRepository(Like);
      const postRepository = manager.getRepository(Post);
      const deleted = await likeRepository.delete({ postId, userId });
      if (deleted.affected === 1) {
        await postRepository.decrement({ id: postId }, 'likeCount', 1);
      }
      const current = await postRepository.findOne({
        where: { id: postId },
        select: ['id', 'likeCount'],
      });
      if (!current) {
        throw new NotFoundException('Post not found after unlike');
      }
      return current.likeCount;
    });

    return {
      isLiked: false,
      likeCount,
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
      await this.dataSource.transaction(async (manager) => {
        const likeRepository = manager.getRepository(CommentLike);
        const commentRepository = manager.getRepository(Comment);
        await likeRepository.save(likeRepository.create({ commentId, userId }));
        await commentRepository.increment({ id: commentId }, 'likeCount', 1);
      });
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

    const likeCount = await this.dataSource.transaction(async (manager) => {
      const likeRepository = manager.getRepository(CommentLike);
      const commentRepository = manager.getRepository(Comment);
      const deleted = await likeRepository.delete({ commentId, userId });
      if (deleted.affected === 1) {
        await commentRepository.decrement({ id: commentId }, 'likeCount', 1);
      }
      const current = await commentRepository.findOne({
        where: { id: commentId },
        select: ['id', 'likeCount'],
      });
      if (!current) {
        throw new NotFoundException('Comment not found after unlike');
      }
      return current.likeCount;
    });

    return {
      isLiked: false,
      likeCount,
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
    const post = await this.getPostForViewer(postId, viewerIsDemo);

    const created = await this.dataSource.transaction(async (manager) => {
      const commentRepository = manager.getRepository(Comment);
      const postRepository = manager.getRepository(Post);

      const comment = commentRepository.create({
        postId,
        authorId: userId,
        content: dto.content,
      });

      const saved = await commentRepository.save(comment);
      await postRepository.increment({ id: postId }, 'commentCount', 1);
      await this.notificationsWriter.write(manager, {
        recipientId: post.authorId,
        actorId: userId,
        type: 'comment',
        sourceId: saved.id,
        postId,
        commentId: saved.id,
      });

      return commentRepository.findOne({
        where: { id: saved.id },
        relations: ['author'],
      });
    });

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
