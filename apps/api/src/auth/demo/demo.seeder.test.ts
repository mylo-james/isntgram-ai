import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, QueryFailedError } from 'typeorm';
import { Follow } from '../../follows/entities/follow.entity';
import { Notification } from '../../notifications/entities/notification.entity';
import { Comment } from '../../posts/entities/comment.entity';
import { CommentLike } from '../../posts/entities/comment-like.entity';
import { Like } from '../../posts/entities/like.entity';
import { Post } from '../../posts/entities/post.entity';
import { User } from '../../users/entities/user.entity';
import {
  DEMO_SEED_POSTS_PER_USER,
  DEMO_SEED_USERS,
  DEMO_USER_INITIAL_POSTS,
} from './demo.constants';
import { DemoSeeder } from './demo.seeder';

jest.mock('argon2', () => ({
  __esModule: true,
  default: { argon2id: 2, hash: jest.fn().mockResolvedValue('seed-password') },
}));

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;
type FixtureUser = User & Row;
type FixturePost = Post & Row;
type TestEntityManager = {
  getRepository: jest.Mock;
  transaction: jest.Mock;
};

const asUser = (row: Row): FixtureUser => row as unknown as FixtureUser;
const asPost = (row: Row): FixturePost => row as unknown as FixturePost;

function valuesFromIn(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  const candidate = value as { _value?: unknown; value?: unknown };
  const raw = candidate._value ?? candidate.value;
  return Array.isArray(raw)
    ? raw.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function matches(row: Row, where: Where): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const values = valuesFromIn(expected);
    return values.length > 0
      ? values.includes(String(row[key]))
      : row[key] === expected;
  });
}

function createHarness(
  options: { nodeEnv?: string; users?: Row[]; posts?: Row[] } = {},
) {
  const users = options.users ?? [];
  const posts = options.posts ?? [];
  const follows: Row[] = [];
  const notifications: Row[] = [];
  let postSequence = posts.length;
  let followSequence = 0;

  const userRepository = {
    findOne: jest.fn(
      async ({ where }: { where: Where }) =>
        users.find((row) => matches(row, where)) ?? null,
    ),
    create: jest.fn((row: Row) => ({ ...row, id: `seed-${users.length + 1}` })),
    save: jest.fn(async (row: Row) => {
      users.push(row);
      return asUser(row);
    }),
    update: jest.fn(async (where: Where, updates: Row) => {
      const row = users.find((candidate) => matches(candidate, where));
      if (row) Object.assign(row, updates);
    }),
    increment: jest.fn(async (where: Where, field: string, amount: number) => {
      const row = users.find((candidate) => matches(candidate, where));
      if (row) row[field] = Number(row[field] ?? 0) + amount;
    }),
  };

  const postRepository = {
    find: jest.fn(async ({ where }: { where: Where }) =>
      posts.filter((row) => matches(row, where)),
    ),
    create: jest.fn((row: Row) => ({ ...row, id: `post-${++postSequence}` })),
    save: jest.fn(async (rows: Row | Row[]) => {
      const list = Array.isArray(rows) ? rows : [rows];
      posts.push(...list);
      return Array.isArray(rows) ? list.map(asPost) : asPost(list[0]);
    }),
    update: jest.fn(async (where: Where, updates: Row) => {
      const row = posts.find((candidate) => matches(candidate, where));
      if (row) Object.assign(row, updates);
    }),
    increment: jest.fn(async (where: Where, field: string, amount: number) => {
      const row = posts.find((candidate) => matches(candidate, where));
      if (row) row[field] = Number(row[field] ?? 0) + amount;
    }),
  };

  const followRepository = {
    find: jest.fn(async ({ where }: { where: Where }) =>
      follows.filter((row) => matches(row, where)),
    ),
    create: jest.fn((row: Row) => ({
      ...row,
      id: `follow-${++followSequence}`,
    })),
    save: jest.fn(async (row: Row) => {
      follows.push(row);
      return row;
    }),
  };
  const notificationRepository = {
    create: jest.fn((row: Row) => ({ ...row })),
    save: jest.fn(async (rows: Row | Row[]) => {
      notifications.push(...(Array.isArray(rows) ? rows : [rows]));
    }),
  };
  const inertRepository = {
    create: jest.fn((row: Row) => ({ ...row, id: 'comment-1' })),
    save: jest.fn(async (row: Row) => row),
    increment: jest.fn(async () => undefined),
  };
  const manager: TestEntityManager = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === User) return userRepository;
      if (entity === Post) return postRepository;
      if (entity === Follow) return followRepository;
      if (entity === Notification) return notificationRepository;
      if (entity === Like || entity === Comment) return inertRepository;
      throw new Error('Unexpected repository');
    }),
    transaction: jest.fn(
      async (work: (tx: TestEntityManager) => Promise<void>) => work(manager),
    ),
  };
  const repository = { ...userRepository, manager };
  const config = {
    get: jest.fn((key: string) =>
      key === 'NODE_ENV' ? (options.nodeEnv ?? 'development') : undefined,
    ),
  };
  return {
    seeder: new DemoSeeder(
      repository as never,
      config as unknown as ConfigService,
    ),
    users,
    posts,
    follows,
    notifications,
    repository,
    postRepository,
    followRepository,
    notificationRepository,
    manager,
  };
}

function seedUser(index: number, overrides: Row = {}): FixtureUser {
  const profile = DEMO_SEED_USERS[index];
  return asUser({
    id: `seed-${index + 1}`,
    username: profile.username,
    fullName: profile.fullName,
    bio: profile.bio,
    profilePictureUrl: profile.profilePictureUrl,
    postsCount: 0,
    followerCount: 0,
    followingCount: 0,
    isDemoUser: true,
    isDemoSeed: true,
    ...overrides,
  });
}

async function createSqliteSeeder(): Promise<{
  dataSource: DataSource;
  seeder: DemoSeeder;
  seeds: User[];
}> {
  const dataSource = new DataSource({
    type: 'sqlite',
    database: ':memory:',
    entities: [User, Post, Like, Comment, CommentLike, Follow, Notification],
    synchronize: true,
  });
  await dataSource.initialize();
  const users = dataSource.getRepository(User);
  const seeds = await users.save(
    DEMO_SEED_USERS.map((profile, index) =>
      users.create({
        id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        email: `${profile.username}@demo.isntgram.local`,
        username: profile.username,
        fullName: profile.fullName,
        bio: profile.bio,
        profilePictureUrl: profile.profilePictureUrl,
        hashedPassword: 'retained-seed-password',
        isDemoUser: true,
        isDemoSeed: true,
        postsCount: 0,
        followerCount: 0,
        followingCount: 0,
      }),
    ),
  );
  return {
    dataSource,
    seeder: new DemoSeeder(users, {
      get: jest.fn(() => 'development'),
    } as unknown as ConfigService),
    seeds,
  };
}

describe('DemoSeeder retained synthetic behavior', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reconciles retained seed profiles and deterministic stored post URLs without fetching them', async () => {
    const stale = seedUser(0, {
      fullName: 'Old name',
      bio: 'Old bio',
      profilePictureUrl: null,
    });
    const { seeder, users, posts } = createHarness({ users: [stale] });

    const seeded = await seeder.ensureDemoSeedUsers();
    await seeder.ensureDemoSeedPosts(seeded);

    expect(users).toHaveLength(DEMO_SEED_USERS.length);
    expect(users[0]).toMatchObject({
      fullName: DEMO_SEED_USERS[0].fullName,
      bio: DEMO_SEED_USERS[0].bio,
      profilePictureUrl: DEMO_SEED_USERS[0].profilePictureUrl,
    });
    expect(posts).toHaveLength(
      DEMO_SEED_USERS.length * DEMO_SEED_POSTS_PER_USER,
    );
    expect(posts.filter((post) => post.authorId === stale.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          mediaUrl: 'https://picsum.photos/seed/demo_seed_ava-0/600/600',
        }),
      ]),
    );
    expect(stale.postsCount).toBe(DEMO_SEED_POSTS_PER_USER);
  });

  it('repairs a stale retained post and reaches the configured count without a repeat increment', async () => {
    const { dataSource, seeder, seeds } = await createSqliteSeeder();
    const posts = dataSource.getRepository(Post);
    const users = dataSource.getRepository(User);
    const seed = seeds[0];

    try {
      const stale = await posts.save(
        posts.create({
          authorId: seed.id,
          content: 'retained content',
          mediaUrl: 'https://example.invalid/stale.jpg',
        }),
      );

      await seeder.ensureDemoSeedPosts([seed]);
      const completed = await posts.find({
        where: { authorId: seed.id },
        order: { createdAt: 'ASC', id: 'ASC' },
      });
      const afterFirst = await users.findOneByOrFail({ id: seed.id });
      await seeder.ensureDemoSeedPosts([seed]);
      const repeated = await posts.countBy({ authorId: seed.id });
      const afterRepeat = await users.findOneByOrFail({ id: seed.id });

      expect(completed).toHaveLength(DEMO_SEED_POSTS_PER_USER);
      expect(completed.find((post) => post.id === stale.id)?.mediaUrl).toBe(
        'https://picsum.photos/seed/demo_seed_ava-0/600/600',
      );
      expect(afterFirst.postsCount).toBe(DEMO_SEED_POSTS_PER_USER - 1);
      expect(repeated).toBe(DEMO_SEED_POSTS_PER_USER);
      expect(afterRepeat.postsCount).toBe(afterFirst.postsCount);
    } finally {
      await dataSource.destroy();
    }
  });

  it('persists bounded synthetic engagement once with row and counter stability on repeat', async () => {
    const { dataSource, seeder, seeds } = await createSqliteSeeder();
    const posts = dataSource.getRepository(Post);
    const likes = dataSource.getRepository(Like);
    const comments = dataSource.getRepository(Comment);
    const commentLikes = dataSource.getRepository(CommentLike);
    const post = await posts.save(
      posts.create({
        authorId: seeds[0].id,
        content: 'retained post',
        mediaUrl: 'https://picsum.photos/seed/retained-0/600/600',
      }),
    );

    try {
      await seeder.seedDemoSeedEngagement(seeds);
      const afterFirst = await posts.findOneByOrFail({ id: post.id });
      const firstComments = await comments.findBy({ postId: post.id });
      const firstRows = {
        likes: await likes.countBy({ postId: post.id }),
        comments: firstComments.length,
        commentLikes: await commentLikes.count(),
        commentLikeCounts: firstComments.map((comment) => comment.likeCount),
      };

      await seeder.seedDemoSeedEngagement(seeds);
      const afterRepeat = await posts.findOneByOrFail({ id: post.id });

      expect(firstRows).toEqual({
        likes: 8,
        comments: 3,
        commentLikes: 6,
        commentLikeCounts: [2, 2, 2],
      });
      expect(afterFirst).toMatchObject({ likeCount: 8, commentCount: 3 });
      expect(await likes.countBy({ postId: post.id })).toBe(firstRows.likes);
      expect(await comments.countBy({ postId: post.id })).toBe(
        firstRows.comments,
      );
      expect(await commentLikes.count()).toBe(firstRows.commentLikes);
      expect(afterRepeat).toMatchObject({ likeCount: 8, commentCount: 3 });
    } finally {
      await dataSource.destroy();
    }
  });

  it('refuses a real username collision before it creates retained demo data', async () => {
    const collision = asUser({
      id: 'ordinary',
      username: DEMO_SEED_USERS[0].username,
      isDemoSeed: false,
    });
    const { seeder, users, repository } = createHarness({ users: [collision] });

    await expect(seeder.ensureDemoSeedUsers()).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(users).toHaveLength(1);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('recovers the concurrently saved unique winner instead of duplicating it', async () => {
    const { seeder, users, repository } = createHarness();
    let raced = false;
    repository.save.mockImplementation(async (row: Row) => {
      if (!raced) {
        raced = true;
        const winner = { ...row, id: 'concurrent-winner' };
        users.push(winner);
        throw new QueryFailedError('INSERT', [], {
          code: '23505',
        } as unknown as Error);
      }
      users.push(row);
      return asUser(row);
    });

    const seeded = await seeder.ensureDemoSeedUsers();

    expect(seeded).toHaveLength(DEMO_SEED_USERS.length);
    expect(
      seeded.find((user) => user.username === DEMO_SEED_USERS[0].username),
    ).toMatchObject({ id: 'concurrent-winner' });
    expect(
      users.filter((user) => user.username === DEMO_SEED_USERS[0].username),
    ).toHaveLength(1);
  });

  it('completes only a visitor post shortfall and leaves a complete visitor unchanged', async () => {
    const visitor = asUser({
      id: 'visitor',
      username: 'visitor',
      fullName: 'Visitor',
      postsCount: 3,
    });
    const retained = Array.from(
      { length: DEMO_USER_INITIAL_POSTS - 1 },
      (_, index) => ({
        id: `existing-${index}`,
        authorId: visitor.id,
        mediaUrl: `retained-${index}`,
      }),
    );
    const { seeder, posts } = createHarness({
      users: [visitor],
      posts: retained,
    });

    const completed = await seeder.seedDemoUserPosts(visitor);
    const countAfterCompletion = posts.length;
    const postsCountAfterCompletion = visitor.postsCount;
    const repeated = await seeder.seedDemoUserPosts(visitor);

    expect(completed).toHaveLength(DEMO_USER_INITIAL_POSTS);
    expect(posts).toHaveLength(DEMO_USER_INITIAL_POSTS);
    expect(visitor.postsCount).toBe(4);
    expect(repeated).toHaveLength(DEMO_USER_INITIAL_POSTS);
    expect(posts).toHaveLength(countAfterCompletion);
    expect(visitor.postsCount).toBe(postsCountAfterCompletion);
  });

  it('adds a deterministic social graph once and maintains follow counters on repeat', async () => {
    const demo = asUser({ id: 'visitor', followingCount: 0, followerCount: 0 });
    const seeds = DEMO_SEED_USERS.map((_, index) => seedUser(index));
    const { seeder, follows, users } = createHarness({
      users: [demo, ...seeds],
    });

    const followers = await seeder.seedDemoSocialGraph(demo.id, seeds);
    const afterFirst = follows.map((follow) => ({ ...follow }));
    const countersAfterFirst = users.map((user) => ({
      id: user.id,
      followerCount: user.followerCount,
      followingCount: user.followingCount,
    }));
    await seeder.seedDemoSocialGraph(demo.id, seeds);

    expect(followers).not.toContainEqual(demo);
    expect(follows).toHaveLength(afterFirst.length);
    expect(follows).toEqual(expect.arrayContaining(afterFirst));
    expect(
      users.map((user) => ({
        id: user.id,
        followerCount: user.followerCount,
        followingCount: user.followingCount,
      })),
    ).toEqual(countersAfterFirst);
    expect(demo.followingCount).toBeGreaterThan(0);
    expect(demo.followerCount).toBeGreaterThan(0);
  });

  it('treats optional notification metadata as absent but preserves unrelated failures', async () => {
    const harness = createHarness();
    const metadataError = new Error('metadata unavailable');
    metadataError.name = 'EntityMetadataNotFoundError';
    harness.manager.getRepository.mockImplementation((entity: unknown) => {
      if (entity === Notification) throw metadataError;
      return harness.postRepository;
    });
    await expect(
      harness.seeder.seedDemoNotifications({
        demoUserId: 'visitor',
        demoPosts: [asPost({ id: 'post-1' })],
        followerUsers: [seedUser(0)],
      }),
    ).resolves.toBeUndefined();
    expect(harness.notifications).toHaveLength(0);

    const failing = createHarness();
    failing.notificationRepository.save.mockRejectedValue(
      new Error('write unavailable'),
    );
    await expect(
      failing.seeder.seedDemoNotifications({
        demoUserId: 'visitor',
        demoPosts: [asPost({ id: 'post-1' })],
        followerUsers: [seedUser(0)],
      }),
    ).rejects.toThrow('write unavailable');
  });

  it('reconciles a retained demo seed found by the username fallback without creating a duplicate', async () => {
    const stale = seedUser(0, {
      fullName: 'Older seed name',
      bio: 'Older seed bio',
      profilePictureUrl: null,
    });
    const { seeder, users, repository } = createHarness({ users: [stale] });
    repository.findOne.mockImplementation(
      async ({ where }: { where: Where }) => {
        if ('isDemoSeed' in where) return null;
        return users.find((row) => matches(row, where)) ?? null;
      },
    );

    const seeded = await seeder.ensureDemoSeedUsers();

    expect(seeded.find((user) => user.id === stale.id)).toMatchObject({
      fullName: DEMO_SEED_USERS[0].fullName,
      bio: DEMO_SEED_USERS[0].bio,
      profilePictureUrl: DEMO_SEED_USERS[0].profilePictureUrl,
    });
    expect(
      users.filter((user) => user.username === stale.username),
    ).toHaveLength(1);
    expect(repository.update).toHaveBeenCalledWith(
      { id: stale.id },
      expect.objectContaining({ fullName: DEMO_SEED_USERS[0].fullName }),
    );
  });

  it('leaves a complete retained seed post set and its counter unchanged', async () => {
    const { dataSource, seeder, seeds } = await createSqliteSeeder();
    const posts = dataSource.getRepository(Post);
    const users = dataSource.getRepository(User);
    const seed = seeds[0];

    try {
      await posts.save(
        Array.from({ length: DEMO_SEED_POSTS_PER_USER }, (_, index) =>
          posts.create({
            authorId: seed.id,
            content: `retained ${index}`,
            mediaUrl: `https://picsum.photos/seed/demo_seed_ava-${index}/600/600`,
          }),
        ),
      );
      await users.update(
        { id: seed.id },
        { postsCount: DEMO_SEED_POSTS_PER_USER },
      );

      await seeder.ensureDemoSeedPosts([seed]);

      expect(await posts.countBy({ authorId: seed.id })).toBe(
        DEMO_SEED_POSTS_PER_USER,
      );
      expect((await users.findOneByOrFail({ id: seed.id })).postsCount).toBe(
        DEMO_SEED_POSTS_PER_USER,
      );
    } finally {
      await dataSource.destroy();
    }
  });

  it('leaves retained rows untouched when an optional engagement repository is unavailable', async () => {
    const { seeder, manager, postRepository } = createHarness();
    manager.getRepository.mockImplementation((entity: unknown) => {
      if (entity === Like)
        throw new Error('optional engagement metadata unavailable');
      return postRepository;
    });

    await expect(
      seeder.seedDemoSeedEngagement([seedUser(0)]),
    ).resolves.toBeUndefined();

    expect(postRepository.find).not.toHaveBeenCalled();
    expect(postRepository.increment).not.toHaveBeenCalled();
  });

  it('does not seed retained engagement in test mode', async () => {
    const { seeder, manager } = createHarness({ nodeEnv: 'test' });
    await seeder.seedDemoSeedEngagement([seedUser(0)]);
    expect(manager.getRepository).not.toHaveBeenCalled();
  });
});
