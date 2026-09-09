import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { Post } from './entities/post.entity';
import { Like } from './entities/like.entity';
import { Comment } from './entities/comment.entity';
import { CommentLike } from './entities/comment-like.entity';
import { User } from '../users/entities/user.entity';
import { MediaUpload } from '../media/entities/media-upload.entity';
import { QueryFailedError } from 'typeorm';

const makeAuthor = (id: string): User =>
  ({
    id,
    username: `user-${id}`,
    fullName: `User ${id}`,
    email: `${id}@example.com`,
    hashedPassword: 'hashed',
    postsCount: 0,
    followerCount: 0,
    followingCount: 0,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    profilePictureUrl: undefined,
  }) as User;

const makePost = (
  id: string,
  createdAt = new Date('2025-01-01T00:00:00.000Z'),
): Post =>
  ({
    id,
    content: `Post ${id}`,
    mediaUrl: undefined,
    likeCount: 0,
    commentCount: 0,
    createdAt,
    updatedAt: createdAt,
    authorId: 'user-1',
    author: makeAuthor('1'),
  }) as Post;

const buildQueryBuilder = (results: Post[]) => {
  const qb = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(results),
  };
  return qb;
};

const buildViewerPostQueryBuilder = (post: Post) => ({
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getOne: jest.fn().mockResolvedValue(post),
});

describe('PostsService', () => {
  const makeService = ({ dbType = 'sqlite' }: { dbType?: string } = {}) => {
    const postRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
      increment: jest.fn(),
      decrement: jest.fn(),
    };
    const likeRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn((data) => ({ ...data })),
      delete: jest.fn(),
    };
    const commentRepository = {
      createQueryBuilder: jest.fn(),
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn(),
      findOne: jest.fn(),
      increment: jest.fn(),
      decrement: jest.fn(),
    };
    const commentLikeRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn((data) => ({ ...data })),
      delete: jest.fn(),
    };
    const followRepository = {
      createQueryBuilder: jest.fn(),
      find: jest.fn(),
    };
    const userRepository = {
      findOne: jest.fn(),
      increment: jest.fn(),
    };
    const mediaService = {
      getOwnedUpload: jest
        .fn()
        .mockResolvedValue({ id: 'upload-1', ownerId: 'user-1' }),
      preparePublication: jest.fn(),
      completeUploadReservation: jest.fn(),
      recordOrphan: jest.fn(),
      toDisplayUrl: jest.fn((value) => value),
    };
    const mediaUploadRepository = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const notificationsWriter = { write: jest.fn() };
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === MediaUpload) return mediaUploadRepository;
        if (entity === Post) return postRepository;
        if (entity === User) return userRepository;
        if (entity === Like) return likeRepository;
        if (entity === Comment) return commentRepository;
        if (entity === CommentLike) return commentLikeRepository;
        return null;
      }),
    };
    const dataSource = {
      options: { type: dbType },
      transaction: jest.fn(
        async (fn: (mgr: typeof manager) => Promise<unknown>) => fn(manager),
      ),
    };

    const rankedCommentsQB = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getQuery: jest.fn().mockReturnValue('ranked'),
      getParameters: jest.fn().mockReturnValue({}),
    };

    const previewCommentsQB = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    commentRepository.createQueryBuilder.mockImplementation((alias: string) => {
      if (alias === 'c') return rankedCommentsQB as any;
      return previewCommentsQB as any;
    });

    const service = new PostsService(
      postRepository as any,
      likeRepository as any,
      commentRepository as any,
      commentLikeRepository as any,
      followRepository as any,
      userRepository as any,
      dataSource as any,
      mediaService as any,
      notificationsWriter as any,
    );

    return {
      service,
      postRepository,
      likeRepository,
      commentRepository,
      commentLikeRepository,
      followRepository,
      userRepository,
      mediaService,
      mediaUploadRepository,
      dataSource,
      manager,
      notificationsWriter,
    };
  };

  it('projects canonical author avatar URLs in post DTOs', () => {
    const { service, mediaService } = makeService();
    const canonical =
      'http://127.0.0.1:48333/isntgram-v1-media/published/550e8400-e29b-41d4-a716-446655440000/660e8400-e29b-41d4-a716-846655440000';
    const display =
      'https://phone.example:9444/isntgram-v1-media/published/550e8400-e29b-41d4-a716-446655440000/660e8400-e29b-41d4-a716-846655440000';
    mediaService.toDisplayUrl.mockReturnValue(display);

    expect(
      (service as any).toAuthorDto({
        ...makeAuthor('1'),
        profilePictureUrl: canonical,
      }),
    ).toMatchObject({
      profilePictureUrl: display,
    });
    expect(mediaService.toDisplayUrl).toHaveBeenCalledWith(canonical);
  });

  describe('verified photo publication', () => {
    const prepared = {
      uploadId: 'upload-1',
      ownerId: 'user-1',
      publishedKey: 'published/user-1/fresh',
      publishedUrl: 'http://localhost/published/user-1/fresh',
      checksum: 'ab'.repeat(32),
      contentType: 'image/png',
      bytes: 100,
      width: 2,
      height: 3,
      frames: 1,
    };
    const request = {
      content: 'A real photo',
      mediaUploadId: 'upload-1',
      mediaAltText: 'A blue boat on a lake',
    };
    const photo = {
      ...makePost('photo-1'),
      authorId: 'user-1',
      content: request.content,
      mediaAltText: request.mediaAltText,
      mediaUrl: prepared.publishedUrl,
    };
    const setup = () => {
      const h = makeService();
      h.mediaService.preparePublication.mockResolvedValue(prepared);
      h.postRepository.create.mockImplementation((value) => value);
      h.postRepository.save.mockResolvedValue({ id: photo.id });
      h.postRepository.findOne.mockResolvedValue(photo);
      return h;
    };

    it('completes storage before the transaction and binds only verified bytes', async () => {
      const h = setup();
      let preparedFinished = false;
      h.mediaService.preparePublication.mockImplementation(async () => {
        expect(h.dataSource.transaction).not.toHaveBeenCalled();
        preparedFinished = true;
        return prepared;
      });
      h.mediaUploadRepository.update.mockImplementation(async () => {
        expect(preparedFinished).toBe(true);
        return { affected: 1 };
      });
      await expect(
        h.service.createPost('user-1', request),
      ).resolves.toMatchObject({
        id: photo.id,
        mediaUrl: prepared.publishedUrl,
      });
      expect(h.postRepository.create).toHaveBeenCalledWith({
        authorId: 'user-1',
        content: request.content,
        mediaAltText: request.mediaAltText,
        mediaUrl: prepared.publishedUrl,
      });
      expect(h.mediaUploadRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'upload-1',
          ownerId: 'user-1',
          postId: expect.any(Object),
          expiresAt: expect.any(Object),
        }),
        {
          postId: photo.id,
          publishedKey: prepared.publishedKey,
          publishedChecksum: prepared.checksum,
          publishedContentType: prepared.contentType,
          publishedBytes: prepared.bytes,
        },
      );
      expect(h.userRepository.increment).toHaveBeenCalledTimes(1);
      expect(h.mediaService.recordOrphan).not.toHaveBeenCalled();
    });

    it('replays the already-bound same-owner/content post without storage or DB writes', async () => {
      const h = setup();
      h.mediaService.getOwnedUpload.mockResolvedValue({ postId: photo.id });
      await expect(
        h.service.createPost('user-1', request),
      ).resolves.toMatchObject({ id: photo.id });
      expect(h.mediaService.preparePublication).not.toHaveBeenCalled();
      expect(h.dataSource.transaction).not.toHaveBeenCalled();
    });

    it('rejects a bound upload when the content changes', async () => {
      const h = setup();
      h.mediaService.getOwnedUpload.mockResolvedValue({ postId: photo.id });
      await expect(
        h.service.createPost('user-1', { ...request, content: 'Another post' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(h.dataSource.transaction).not.toHaveBeenCalled();
    });

    it.each(['Changed description', '', undefined])(
      'rejects a changed or cleared description: %s',
      async (mediaAltText) => {
        const h = setup();
        h.mediaService.getOwnedUpload.mockResolvedValue({ postId: photo.id });
        await expect(
          h.service.createPost('user-1', { ...request, mediaAltText }),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(h.dataSource.transaction).not.toHaveBeenCalled();
        expect(h.mediaService.preparePublication).not.toHaveBeenCalled();
      },
    );
    it('normalizes description whitespace for the original replay', async () => {
      const h = setup();
      h.mediaService.getOwnedUpload.mockResolvedValue({ postId: photo.id });
      await expect(
        h.service.createPost('user-1', {
          ...request,
          mediaAltText: `  ${request.mediaAltText}  `,
        }),
      ).resolves.toMatchObject({
        id: photo.id,
        mediaAltText: request.mediaAltText,
      });
    });
    it('rejects a description without photo authority', async () => {
      const h = setup();
      await expect(
        h.service.createPost('user-1', {
          content: 'Caption',
          mediaAltText: 'A boat',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(h.dataSource.transaction).not.toHaveBeenCalled();
    });

    it('denies another owner before storage or transaction work', async () => {
      const h = setup();
      h.mediaService.getOwnedUpload.mockRejectedValue(new NotFoundException());
      await expect(
        h.service.createPost('user-2', request),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(h.mediaService.getOwnedUpload).toHaveBeenCalledWith(
        'user-2',
        request.mediaUploadId,
      );
      expect(h.mediaService.preparePublication).not.toHaveBeenCalled();
      expect(h.dataSource.transaction).not.toHaveBeenCalled();
    });

    it('resolves a concurrent binding found during preparation to the same post', async () => {
      const h = setup();
      h.mediaService.getOwnedUpload
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ postId: photo.id });
      h.mediaService.preparePublication.mockRejectedValue(
        new ConflictException(),
      );
      await expect(
        h.service.createPost('user-1', request),
      ).resolves.toMatchObject({ id: photo.id });
      expect(h.dataSource.transaction).not.toHaveBeenCalled();
    });

    it('surfaces decode or storage failure without opening a transaction', async () => {
      const h = setup();
      const failure = new BadRequestException('Media could not be decoded');
      h.mediaService.preparePublication.mockRejectedValue(failure);
      await expect(h.service.createPost('user-1', request)).rejects.toBe(
        failure,
      );
      expect(h.dataSource.transaction).not.toHaveBeenCalled();
    });

    it('loses the conditional claim without incrementing the count and returns the winner', async () => {
      const h = setup();
      h.mediaService.getOwnedUpload
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ postId: photo.id });
      h.mediaUploadRepository.update.mockResolvedValue({ affected: 0 });
      await expect(
        h.service.createPost('user-1', request),
      ).resolves.toMatchObject({ id: photo.id });
      expect(h.userRepository.increment).not.toHaveBeenCalled();
      expect(h.mediaService.recordOrphan).toHaveBeenCalledWith(
        prepared,
        'post_transaction_failed',
      );
    });

    it('reports an expired conditional claim as a recoverable conflict', async () => {
      const h = setup();
      h.mediaUploadRepository.update.mockResolvedValue({ affected: 0 });
      await expect(
        h.service.createPost('user-1', request),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(h.userRepository.increment).not.toHaveBeenCalled();
      expect(h.mediaService.recordOrphan).toHaveBeenCalledTimes(1);
    });

    it('retains the published object and records it after database failure', async () => {
      const h = setup();
      const failure = new Error('database write failure');
      h.userRepository.increment.mockRejectedValue(failure);
      await expect(h.service.createPost('user-1', request)).rejects.toBe(
        failure,
      );
      expect(h.mediaService.recordOrphan).toHaveBeenCalledWith(
        prepared,
        'post_transaction_failed',
      );
    });

    it('waits for the durable orphan intent before returning a transaction failure', async () => {
      const h = setup();
      const failure = new Error('database write failure');
      let persist!: () => void;
      h.userRepository.increment.mockRejectedValue(failure);
      h.mediaService.recordOrphan.mockImplementation(
        () => new Promise<void>((resolve) => { persist = resolve; }),
      );

      const result = h.service.createPost('user-1', request);
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(h.mediaService.recordOrphan).toHaveBeenCalledWith(
        prepared,
        'post_transaction_failed',
      );
      expect(h.mediaService.completeUploadReservation).not.toHaveBeenCalled();

      persist();
      await expect(result).rejects.toBe(failure);
    });
  });

  describe('createPost', () => {
    it('throws when media host is unsupported', async () => {
      const { service } = makeService();

      await expect(
        service.createPost('user-1', {
          content: 'Hello',
          mediaUrl: 'https://evil.com/file.jpg',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects even a previously allowed media host without upload authority', async () => {
      const { service, dataSource, mediaService } = makeService();
      await expect(
        service.createPost('user-1', {
          content: 'Hello',
          mediaUrl: 'https://cdn.isntgram.ai/file.jpg',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(mediaService.preparePublication).not.toHaveBeenCalled();
    });

    it('throws when the created post cannot be loaded after save', async () => {
      const { service, postRepository, userRepository } = makeService();

      postRepository.create.mockReturnValueOnce({
        authorId: 'user-1',
        content: 'Hello',
      });
      postRepository.save.mockResolvedValueOnce({ id: 'post-1' });
      userRepository.increment.mockResolvedValueOnce(undefined);
      postRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.createPost('user-1', { content: 'Hello' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns a PostDto when creation succeeds', async () => {
      const { service, postRepository, userRepository, mediaService } =
        makeService();

      const createdAt = new Date('2025-01-01T00:00:00.000Z');
      const updatedAt = new Date('2025-01-01T00:00:00.000Z');

      postRepository.create.mockReturnValueOnce({
        authorId: 'user-1',
        content: 'Hello',
        mediaUrl: undefined,
      });
      postRepository.save.mockResolvedValueOnce({ id: 'post-1' });
      userRepository.increment.mockResolvedValueOnce(undefined);
      postRepository.findOne.mockResolvedValueOnce({
        id: 'post-1',
        content: 'Hello',
        mediaUrl: undefined,
        createdAt,
        updatedAt,
        author: {
          id: 'user-1',
          username: 'me',
          fullName: 'Me',
          email: 'me@example.com',
          hashedPassword: 'hashed',
          postsCount: 0,
          followerCount: 0,
          followingCount: 0,
          createdAt,
          updatedAt,
          profilePictureUrl: undefined,
        } as User,
      } as Post);

      mediaService.toDisplayUrl.mockReturnValueOnce(
        'https://phone.example/isntgram-v1-media/published/owner/object',
      );
      await expect(
        service.createPost('user-1', { content: 'Hello' }),
      ).resolves.toEqual({
        id: 'post-1',
        content: 'Hello',
        mediaUrl:
          'https://phone.example/isntgram-v1-media/published/owner/object',
        likeCount: 0,
        commentCount: 0,
        previewComments: [],
        likedByViewer: false,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        author: {
          id: 'user-1',
          username: 'me',
          fullName: 'Me',
          profilePictureUrl: undefined,
        },
      });
      expect(mediaService.toDisplayUrl).toHaveBeenCalledWith(undefined);
      expect(postRepository.findOne.mock.calls[0][0]).toEqual({
        where: { id: 'post-1' },
        relations: ['author'],
      });
    });
  });

  describe('getFeed', () => {
    it('returns items without cursor when results fit limit', async () => {
      const { service, postRepository, followRepository } = makeService();
      const postsQB = buildQueryBuilder([makePost('p1')]);
      const followQB = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getQuery: jest.fn().mockReturnValue('subquery'),
      };

      followRepository.createQueryBuilder.mockReturnValueOnce(followQB);
      postRepository.createQueryBuilder.mockReturnValueOnce(postsQB);

      const result = await service.getFeed('user-1', false, { limit: 2 });

      expect(result.items).toHaveLength(1);
      expect(result.nextCursor).toBeUndefined();
      expect(postsQB.andWhere).toHaveBeenCalledWith(
        'author.isDemoUser = :viewerIsDemo',
        { viewerIsDemo: false },
      );
    });

    it('returns nextCursor when more items than limit', async () => {
      const { service, postRepository, followRepository } = makeService();
      const results = [makePost('p1'), makePost('p2')];
      const postsQB = buildQueryBuilder(results);
      const followQB = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getQuery: jest.fn().mockReturnValue('subquery'),
      };

      followRepository.createQueryBuilder.mockReturnValueOnce(followQB);
      postRepository.createQueryBuilder.mockReturnValueOnce(postsQB);

      const cursor = (service as any).encodeCursor(results[0]);
      const result = await service.getFeed('user-1', false, {
        limit: 1,
        cursor,
      });

      expect(postsQB.andWhere).toHaveBeenCalled();
      expect(result.items).toHaveLength(1);
      expect(result.nextCursor).toBe((service as any).encodeCursor(results[0]));
    });
  });

  describe('getUserPosts', () => {
    it('throws when user does not exist', async () => {
      const { service, userRepository } = makeService();
      userRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.getUserPosts('missing', { isDemoUser: false }, {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('applies cursor filter when provided', async () => {
      const { service, postRepository, userRepository } = makeService();
      userRepository.findOne.mockResolvedValueOnce({ id: 'user-1' } as User);

      const results = [makePost('p1'), makePost('p2')];
      const postsQB = buildQueryBuilder(results);
      postRepository.createQueryBuilder.mockReturnValueOnce(postsQB);

      const cursor = (service as any).encodeCursor(results[0]);
      const result = await service.getUserPosts(
        'user-1',
        { isDemoUser: false },
        {
          limit: 1,
          cursor,
        },
      );

      expect(postsQB.andWhere).toHaveBeenCalled();
      expect(result.nextCursor).toBe((service as any).encodeCursor(results[0]));
    });
  });

  describe('conditional reaction removal', () => {
    it('decrements a post count only when its conditional like delete removes one row', async () => {
      const { service, postRepository, likeRepository, manager } =
        makeService();
      const post = { ...makePost('post-1'), likeCount: 1 };
      postRepository.createQueryBuilder.mockReturnValueOnce(
        buildViewerPostQueryBuilder(post),
      );
      postRepository.findOne.mockResolvedValueOnce({
        id: post.id,
        likeCount: 1,
      });
      likeRepository.findOne.mockResolvedValueOnce({
        id: 'like-1',
        postId: post.id,
        userId: 'user-1',
      });
      likeRepository.delete.mockResolvedValueOnce({ affected: 0 });

      await expect(
        service.unlikePost('user-1', false, post.id),
      ).resolves.toEqual({ isLiked: false, likeCount: 1 });

      expect(likeRepository.delete).toHaveBeenCalledWith({
        postId: post.id,
        userId: 'user-1',
      });
      expect(postRepository.decrement).not.toHaveBeenCalled();
      expect(manager.getRepository).toHaveBeenCalledWith(Like);
    });

    it('decrements a comment count only when its conditional like delete removes one row', async () => {
      const {
        service,
        postRepository,
        commentRepository,
        commentLikeRepository,
      } = makeService();
      const post = makePost('post-1');
      postRepository.createQueryBuilder.mockReturnValueOnce(
        buildViewerPostQueryBuilder(post),
      );
      commentRepository.findOne
        .mockResolvedValueOnce({
          id: 'comment-1',
          postId: post.id,
          likeCount: 1,
        })
        .mockResolvedValueOnce({ id: 'comment-1', likeCount: 1 });
      commentLikeRepository.findOne.mockResolvedValueOnce({
        id: 'comment-like-1',
        commentId: 'comment-1',
        userId: 'user-1',
      });
      commentLikeRepository.delete.mockResolvedValueOnce({ affected: 0 });

      await expect(
        service.unlikeComment('user-1', false, post.id, 'comment-1'),
      ).resolves.toEqual({ isLiked: false, likeCount: 1 });

      expect(commentLikeRepository.delete).toHaveBeenCalledWith({
        commentId: 'comment-1',
        userId: 'user-1',
      });
      expect(commentRepository.decrement).not.toHaveBeenCalled();
    });
  });

  describe('reaction race recovery', () => {
    it('returns the authoritative post count when the insert loses a unique race', async () => {
      const { service, postRepository, likeRepository, notificationsWriter } =
        makeService();
      const post = { ...makePost('post-1'), likeCount: 0 };
      postRepository.createQueryBuilder.mockReturnValueOnce(
        buildViewerPostQueryBuilder(post),
      );
      likeRepository.findOne.mockResolvedValueOnce(null);
      likeRepository.save.mockRejectedValueOnce(
        new QueryFailedError('INSERT INTO likes', [], {
          code: 'SQLITE_CONSTRAINT',
        } as unknown as Error),
      );
      postRepository.findOne.mockResolvedValueOnce({
        id: post.id,
        likeCount: 4,
        commentCount: 0,
      });

      await expect(service.likePost('user-1', false, post.id)).resolves.toEqual(
        { isLiked: true, likeCount: 4 },
      );

      expect(notificationsWriter.write).not.toHaveBeenCalled();
    });

    it('returns the authoritative comment count when the insert loses a unique race', async () => {
      const {
        service,
        postRepository,
        commentRepository,
        commentLikeRepository,
      } = makeService();
      const post = makePost('post-1');
      postRepository.createQueryBuilder.mockReturnValueOnce(
        buildViewerPostQueryBuilder(post),
      );
      commentRepository.findOne
        .mockResolvedValueOnce({
          id: 'comment-1',
          postId: post.id,
          likeCount: 0,
        })
        .mockResolvedValueOnce({ id: 'comment-1', likeCount: 4 });
      commentLikeRepository.findOne.mockResolvedValueOnce(null);
      commentLikeRepository.save.mockRejectedValueOnce(
        new QueryFailedError('INSERT INTO comment_likes', [], {
          code: 'SQLITE_CONSTRAINT',
        } as unknown as Error),
      );

      await expect(
        service.likeComment('user-1', false, post.id, 'comment-1'),
      ).resolves.toEqual({ isLiked: true, likeCount: 4 });
    });
  });

  describe('notification-producing actions', () => {
    it('writes the persisted like identity in the same transaction', async () => {
      const {
        service,
        postRepository,
        likeRepository,
        notificationsWriter,
        manager,
      } = makeService();
      const post = {
        ...makePost('post-1'),
        authorId: 'post-author',
        likeCount: 0,
      };
      postRepository.createQueryBuilder.mockReturnValueOnce(
        buildViewerPostQueryBuilder(post),
      );
      likeRepository.findOne.mockResolvedValueOnce(null);
      likeRepository.create.mockReturnValueOnce({
        id: 'like-action-id',
        postId: post.id,
        userId: 'actor-id',
      });
      likeRepository.save.mockResolvedValueOnce({ id: 'like-action-id' });
      postRepository.findOne.mockResolvedValueOnce({
        id: post.id,
        likeCount: 1,
        commentCount: 0,
      });

      await service.likePost('actor-id', false, post.id);

      expect(notificationsWriter.write).toHaveBeenCalledWith(manager, {
        recipientId: 'post-author',
        actorId: 'actor-id',
        type: 'like',
        sourceId: 'like-action-id',
        postId: post.id,
      });
    });

    it('propagates a notification failure from the action transaction', async () => {
      const { service, postRepository, likeRepository, notificationsWriter } =
        makeService();
      const post = {
        ...makePost('post-1'),
        authorId: 'post-author',
        likeCount: 0,
      };
      postRepository.createQueryBuilder.mockReturnValueOnce(
        buildViewerPostQueryBuilder(post),
      );
      likeRepository.findOne.mockResolvedValueOnce(null);
      likeRepository.create.mockReturnValueOnce({ id: 'like-action-id' });
      likeRepository.save.mockResolvedValueOnce({ id: 'like-action-id' });
      notificationsWriter.write.mockRejectedValueOnce(
        new Error('notification insert failed'),
      );

      await expect(
        service.likePost('actor-id', false, post.id),
      ).rejects.toThrow('notification insert failed');
    });

    it('writes each persisted comment identity, including identical comment text', async () => {
      const {
        service,
        postRepository,
        commentRepository,
        notificationsWriter,
        manager,
      } = makeService();
      const post = {
        ...makePost('post-1'),
        authorId: 'post-author',
      };
      const createdAt = new Date('2025-01-01T00:00:00.000Z');
      postRepository.createQueryBuilder.mockReturnValueOnce(
        buildViewerPostQueryBuilder(post),
      );
      commentRepository.create.mockReturnValueOnce({
        postId: post.id,
        authorId: 'actor-id',
        content: 'same text',
      });
      commentRepository.save.mockResolvedValueOnce({ id: 'comment-action-id' });
      commentRepository.findOne.mockResolvedValueOnce({
        id: 'comment-action-id',
        postId: post.id,
        content: 'same text',
        likeCount: 0,
        createdAt,
        updatedAt: createdAt,
        author: makeAuthor('actor-id'),
      } as Comment);

      await service.createComment('actor-id', false, post.id, {
        content: 'same text',
      });

      expect(notificationsWriter.write).toHaveBeenCalledWith(manager, {
        recipientId: 'post-author',
        actorId: 'actor-id',
        type: 'comment',
        sourceId: 'comment-action-id',
        postId: post.id,
        commentId: 'comment-action-id',
      });
    });
  });

  describe('cursor helpers', () => {
    it('decodes valid cursor', () => {
      const { service } = makeService();
      const createdAt = new Date('2025-01-02T00:00:00.000Z');
      const cursor = (service as any).encodeCursor({ id: 'p1', createdAt });

      const decoded = (service as any).decodeCursor(cursor);
      expect(decoded.id).toBe('p1');
      expect(decoded.createdAt.toISOString()).toBe(createdAt.toISOString());
    });

    it('rejects invalid cursor shapes', () => {
      const { service } = makeService();
      const cursor = Buffer.from('no-separator').toString('base64');

      expect(() => (service as any).decodeCursor(cursor)).toThrow(
        BadRequestException,
      );
    });

    it('rejects invalid cursor timestamps', () => {
      const { service } = makeService();
      const cursor = Buffer.from('not-a-date|p1').toString('base64');

      expect(() => (service as any).decodeCursor(cursor)).toThrow(
        BadRequestException,
      );
    });

    it('formats cursor createdAt for sqlite', () => {
      const { service } = makeService({ dbType: 'sqlite' });
      const createdAt = new Date('2025-01-02T03:04:05.678Z');

      const formatted = (service as any).toCursorCreatedAtParam(createdAt);
      expect(formatted).toBe('2025-01-02 03:04:05');
    });

    it('preserves cursor createdAt for non-sqlite', () => {
      const { service } = makeService({ dbType: 'postgres' });
      const createdAt = new Date('2025-01-02T03:04:05.678Z');

      const formatted = (service as any).toCursorCreatedAtParam(createdAt);
      expect(formatted).toBe(createdAt);
    });
  });
});
