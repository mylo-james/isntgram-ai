import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PostsService } from './posts.service';
import { Post } from './entities/post.entity';
import { User } from '../users/entities/user.entity';

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

describe('PostsService', () => {
  const makeService = ({
    dbType = 'sqlite',
    mediaHosts,
  }: { dbType?: string; mediaHosts?: string } = {}) => {
    const postRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    const followRepository = {
      createQueryBuilder: jest.fn(),
      find: jest.fn(),
    };
    const userRepository = {
      findOne: jest.fn(),
      increment: jest.fn(),
    };
    const configService = {
      get: jest.fn((key: string) =>
        key === 'MEDIA_ALLOWED_HOSTS' ? mediaHosts : undefined,
      ),
    };
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === Post) return postRepository;
        if (entity === User) return userRepository;
        return null;
      }),
    };
    const dataSource = {
      options: { type: dbType },
      transaction: jest.fn(
        async (fn: (mgr: typeof manager) => Promise<unknown>) => fn(manager),
      ),
    };

    const service = new PostsService(
      postRepository as any,
      followRepository as any,
      userRepository as any,
      dataSource as any,
      configService as any,
    );

    return {
      service,
      postRepository,
      followRepository,
      userRepository,
      configService,
      dataSource,
      manager,
    };
  };

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

    it('allows media url when host is configured', async () => {
      const { service, postRepository, userRepository } = makeService({
        mediaHosts: 'media.example.com',
      });

      const createdAt = new Date('2025-01-01T00:00:00.000Z');
      postRepository.create.mockReturnValueOnce({
        authorId: 'user-1',
        content: 'Hello',
        mediaUrl: 'https://media.example.com/file.jpg',
      });
      postRepository.save.mockResolvedValueOnce({ id: 'post-1' });
      userRepository.increment.mockResolvedValueOnce(undefined);
      postRepository.findOne.mockResolvedValueOnce({
        id: 'post-1',
        content: 'Hello',
        mediaUrl: 'https://media.example.com/file.jpg',
        createdAt,
        updatedAt: createdAt,
        author: makeAuthor('1'),
      } as Post);

      await expect(
        service.createPost('user-1', {
          content: 'Hello',
          mediaUrl: 'https://media.example.com/file.jpg',
        }),
      ).resolves.toMatchObject({
        id: 'post-1',
        mediaUrl: 'https://media.example.com/file.jpg',
      });
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
      const { service, postRepository, userRepository } = makeService();

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

      await expect(
        service.createPost('user-1', { content: 'Hello' }),
      ).resolves.toEqual({
        id: 'post-1',
        content: 'Hello',
        mediaUrl: undefined,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        author: {
          id: 'user-1',
          username: 'me',
          fullName: 'Me',
          profilePictureUrl: undefined,
        },
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

      const result = await service.getFeed('user-1', { limit: 2 });

      expect(result.items).toHaveLength(1);
      expect(result.nextCursor).toBeUndefined();
      expect(postsQB.andWhere).not.toHaveBeenCalled();
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
      const result = await service.getFeed('user-1', { limit: 1, cursor });

      expect(postsQB.andWhere).toHaveBeenCalled();
      expect(result.items).toHaveLength(1);
      expect(result.nextCursor).toBe((service as any).encodeCursor(results[0]));
    });
  });

  describe('getUserPosts', () => {
    it('throws when user does not exist', async () => {
      const { service, userRepository } = makeService();
      userRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.getUserPosts('missing', {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('applies cursor filter when provided', async () => {
      const { service, postRepository, userRepository } = makeService();
      userRepository.findOne.mockResolvedValueOnce({ id: 'user-1' } as User);

      const results = [makePost('p1'), makePost('p2')];
      const postsQB = buildQueryBuilder(results);
      postRepository.createQueryBuilder.mockReturnValueOnce(postsQB);

      const cursor = (service as any).encodeCursor(results[0]);
      const result = await service.getUserPosts('user-1', {
        limit: 1,
        cursor,
      });

      expect(postsQB.andWhere).toHaveBeenCalled();
      expect(result.nextCursor).toBe((service as any).encodeCursor(results[0]));
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

  describe('media url helpers', () => {
    it('rejects invalid media url inputs', () => {
      const { service } = makeService();
      expect((service as any).isAllowedMediaUrl('not-a-url')).toBe(false);
      expect(
        (service as any).isAllowedMediaUrl('ftp://cdn.isntgram.ai/file'),
      ).toBe(false);
    });

    it('accepts default allowed hosts', () => {
      const { service } = makeService();
      expect(
        (service as any).isAllowedMediaUrl('https://cdn.isntgram.ai/file'),
      ).toBe(true);
      expect(
        (service as any).isAllowedMediaUrl('http://localhost:9000/file'),
      ).toBe(true);
    });
  });
});
