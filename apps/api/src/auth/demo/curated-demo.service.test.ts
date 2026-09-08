import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import argon2 from 'argon2';
import { EntityManager, Repository } from 'typeorm';
import {
  Corpus,
  fixturePosts,
  loadCuratedCorpus,
  readCorpusPhoto,
} from '../../fixtures/curated-corpus';
import { MediaUpload } from '../../media/entities/media-upload.entity';
import { MediaService } from '../../media/media.service';
import { Post } from '../../posts/entities/post.entity';
import { User } from '../../users/entities/user.entity';
import { AuthService } from '../auth.service';
import { CuratedDemoService } from './curated-demo.service';

jest.mock('argon2');
jest.mock('../../fixtures/curated-corpus', () => ({
  loadCuratedCorpus: jest.fn(),
  fixturePosts: jest.fn(),
  readCorpusPhoto: jest.fn(),
}));

const demoSeeds = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    username: 'v1_demo_north',
    fullName: 'Curated Demo North',
    email: 'v1-demo-north@example.invalid',
    isDemoUser: true,
    isDemoSeed: true,
    bio: 'Fictional demo account.',
    posts: [
      {
        id: '21111111-1111-4111-8111-111111111111',
        photoId: '00457',
        uploadId: '31111111-1111-4111-8111-111111111111',
      },
      {
        id: '21111111-1111-4111-8111-111111111112',
        photoId: '07190',
        uploadId: '31111111-1111-4111-8111-111111111112',
      },
      {
        id: '21111111-1111-4111-8111-111111111113',
        photoId: '07191',
        uploadId: '31111111-1111-4111-8111-111111111113',
      },
    ],
  },
  {
    id: '11111111-1111-4111-8111-111111111112',
    username: 'v1_demo_river',
    fullName: 'Curated Demo River',
    email: 'v1-demo-river@example.invalid',
    isDemoUser: true,
    isDemoSeed: true,
    bio: 'Fictional demo account.',
    posts: [
      {
        id: '21111111-1111-4111-8111-111111111114',
        photoId: '00457',
        uploadId: '31111111-1111-4111-8111-111111111114',
      },
      {
        id: '21111111-1111-4111-8111-111111111115',
        photoId: '07190',
        uploadId: '31111111-1111-4111-8111-111111111115',
      },
      {
        id: '21111111-1111-4111-8111-111111111116',
        photoId: '07191',
        uploadId: '31111111-1111-4111-8111-111111111116',
      },
    ],
  },
] as const;

const photos = [
  {
    id: '00457',
    postId: '41111111-1111-4111-8111-111111111112',
    uploadId: '51111111-1111-4111-8111-111111111111',
    altText: 'Everts',
    caption: 'Everts',
    original: {
      bytes: 10,
      mime: 'image/jpeg',
      fileName: '00457.jpg',
      sha256: 'a',
    },
    validated: {
      bytes: 8,
      contentType: 'image/jpeg',
      sha256: 'a'.repeat(64),
      width: 1,
      height: 1,
      frames: 1,
    },
  },
  {
    id: '07190',
    postId: '41111111-1111-4111-8111-111111111113',
    uploadId: '51111111-1111-4111-8111-111111111112',
    altText: 'Prairie',
    caption: 'Prairie',
    original: {
      bytes: 11,
      mime: 'image/jpeg',
      fileName: '07190.jpg',
      sha256: 'b',
    },
    validated: {
      bytes: 9,
      contentType: 'image/jpeg',
      sha256: 'b'.repeat(64),
      width: 1,
      height: 1,
      frames: 1,
    },
  },
  {
    id: '07191',
    postId: '41111111-1111-4111-8111-111111111114',
    uploadId: '51111111-1111-4111-8111-111111111113',
    altText: 'Lamar',
    caption: 'Lamar',
    original: {
      bytes: 12,
      mime: 'image/jpeg',
      fileName: '07191.jpg',
      sha256: 'c',
    },
    validated: {
      bytes: 10,
      contentType: 'image/jpeg',
      sha256: 'c'.repeat(64),
      width: 1,
      height: 1,
      frames: 1,
    },
  },
];

const corpus: Corpus = {
  version: 'isntgram-v1-curated-1',
  actors: [],
  photos,
  textPost: { id: '41111111-1111-4111-8111-111111111111', content: 'Text' },
  demoSeeds: demoSeeds.map((seed) => ({
    ...seed,
    posts: seed.posts.map((post) => ({ ...post })),
  })),
};

type Repo = {
  findOne: jest.Mock;
  count: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
};

type Harness = {
  service: CuratedDemoService;
  query: jest.Mock;
  users: Repo;
  save: jest.Mock;
  config: { get: jest.Mock };
  media: { verifyBoundPublication: jest.Mock };
};

function buildHarness(
  options: {
    recordLimit?: string;
    includeBindings?: boolean;
    retained?: number;
  } = {},
): Harness {
  const saved: User[] = [];
  const boundUsers = new Map<string, User>(
    demoSeeds.map((seed) => [
      seed.id,
      {
        ...seed,
        postsCount: 3,
        followerCount: 0,
        followingCount: 0,
        tokenVersion: 0,
      } as unknown as User,
    ]),
  );
  const boundPosts = new Map<string, Post>();
  const boundUploads = new Map<string, MediaUpload>();
  for (const seed of demoSeeds) {
    for (const seedPost of seed.posts) {
      const photo = photos.find(
        (candidate) => candidate.id === seedPost.photoId,
      )!;
      const key = `published/${seedPost.uploadId}`;
      boundPosts.set(seedPost.id, {
        id: seedPost.id,
        authorId: seed.id,
        content: photo.caption,
        mediaAltText: photo.altText,
        mediaUrl: `https://media.example/${key}`,
      } as Post);
      boundUploads.set(seedPost.uploadId, {
        id: seedPost.uploadId,
        ownerId: seed.id,
        postId: seedPost.id,
        pendingKey: `pending/${seed.id}/${seedPost.uploadId}`,
        expectedBytes: photo.original.bytes,
        expectedContentType: photo.original.mime,
        publishedKey: key,
        publishedChecksum: photo.validated.sha256,
        publishedBytes: photo.validated.bytes,
        publishedContentType: photo.validated.contentType,
      } as MediaUpload);
    }
  }
  if (options.includeBindings === false) boundUsers.clear();

  const save = jest.fn(async (user: User) => {
    const savedUser = {
      ...user,
      tokenVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as User;
    saved.push(savedUser);
    return savedUser;
  });
  const users: Repo = {
    findOne: jest.fn(
      async ({ where }: { where: { id: string } }) =>
        boundUsers.get(where.id) ?? null,
    ),
    count: jest.fn(
      async ({ where }: { where: { authorId: string } }) =>
        demoSeeds.find((seed) => seed.id === where.authorId)?.posts.length ?? 0,
    ),
    create: jest.fn((value: User) => value),
    save,
  };
  const posts: Repo = {
    findOne: jest.fn(
      async ({ where }: { where: { id: string } }) =>
        boundPosts.get(where.id) ?? null,
    ),
    count: jest.fn(
      async ({ where }: { where: { authorId: string } }) =>
        demoSeeds.find((seed) => seed.id === where.authorId)?.posts.length ?? 0,
    ),
    create: jest.fn(),
    save: jest.fn(),
  };
  const uploads: Repo = {
    findOne: jest.fn(
      async ({ where }: { where: { id: string } }) =>
        boundUploads.get(where.id) ?? null,
    ),
    count: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('pg_try_advisory_xact_lock')) return [{ locked: true }];
    return [{ count: String(options.retained ?? 20) }];
  });
  const manager = {
    query,
    getRepository: (entity: unknown): Repo => {
      if (entity === User) return users;
      if (entity === Post) return posts;
      return uploads;
    },
  } as unknown as EntityManager;
  let previousTransaction: Promise<void> = Promise.resolve();
  const transaction = async <T>(
    fn: (transactionManager: EntityManager) => Promise<T>,
  ): Promise<T> => {
    const previous = previousTransaction;
    let release!: () => void;
    previousTransaction = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await fn(manager);
    } finally {
      release();
    }
  };
  const rootRepository = {
    manager: { transaction },
  } as unknown as Repository<User>;
  const config = {
    get: jest.fn(
      (key: string) =>
        ({
          DEMO_ENABLED: 'true',
          DEMO_CONTENT_SOURCE: 'curated',
          DEMO_RECORD_LIMIT: options.recordLimit ?? '1000',
          DEMO_TTL_HOURS: '1.9',
          S3_PUBLIC_BASE_URL: 'https://media.example/',
        })[key],
    ),
  };
  const auth = {
    signAccessToken: jest.fn().mockResolvedValue('demo-token'),
    toSafeUser: jest.fn((user: User) => ({
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      postCount: 0,
      followerCount: 0,
      followingCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
  } as unknown as AuthService;
  const media = {
    verifyBoundPublication: jest.fn(
      async (ownerId: string, uploadId: string) => {
        const upload = boundUploads.get(uploadId);
        if (!upload || upload.ownerId !== ownerId)
          throw new Error('Missing object');
        return {
          postId: upload.postId,
          ownerId,
          uploadId,
          key: upload.publishedKey,
          checksum: upload.publishedChecksum,
          bytes: upload.publishedBytes,
          contentType: upload.publishedContentType,
          url: `https://media.example/${upload.publishedKey}`,
        };
      },
    ),
  };
  return {
    service: new CuratedDemoService(
      rootRepository,
      config as unknown as ConfigService,
      auth,
      media as unknown as MediaService,
    ),
    query,
    users,
    save,
    config,
    media,
  };
}

describe('CuratedDemoService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (loadCuratedCorpus as jest.Mock).mockReturnValue(corpus);
    (fixturePosts as jest.Mock).mockImplementation((value: Corpus) =>
      value.demoSeeds.flatMap((seed) =>
        seed.posts.map((post) => ({ ...post, authorId: seed.id })),
      ),
    );
    (argon2.hash as jest.Mock).mockResolvedValue('random-hash');
    (readCorpusPhoto as jest.Mock).mockReturnValue(
      Buffer.from('reviewed photo'),
    );
  });

  it('refuses disabled or non-curated mode before transaction work', async () => {
    const h = buildHarness();
    h.config.get.mockImplementation((key: string) =>
      key === 'DEMO_ENABLED' ? 'false' : 'curated',
    );
    await expect(h.service.createSession()).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(h.query).not.toHaveBeenCalled();
  });

  it('refuses a missing curated binding before visitor creation', async () => {
    const h = buildHarness({ includeBindings: false });
    await expect(h.service.createSession()).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(h.save).not.toHaveBeenCalled();
  });

  it('refuses missing local corpus bytes before any storage or database work', async () => {
    const h = buildHarness();
    (readCorpusPhoto as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Missing original');
    });
    await expect(h.service.createSession()).rejects.toThrow('Missing original');
    expect(h.media.verifyBoundPublication).not.toHaveBeenCalled();
    expect(h.query).not.toHaveBeenCalled();
    expect(h.save).not.toHaveBeenCalled();
  });

  it('refuses a missing or changed published object before inserting a visitor', async () => {
    const h = buildHarness();
    h.media.verifyBoundPublication.mockRejectedValueOnce(
      new Error('Missing object'),
    );
    await expect(h.service.createSession()).rejects.toThrow('Missing object');
    expect(h.query).not.toHaveBeenCalled();
    expect(h.save).not.toHaveBeenCalled();
  });

  it('takes the advisory transaction lock, checks every app table, and creates an empty neutral visitor', async () => {
    const h = buildHarness();
    const result = await h.service.createSession();
    expect(readCorpusPhoto).toHaveBeenCalledTimes(3);
    expect(h.media.verifyBoundPublication).toHaveBeenCalledTimes(6);
    expect(h.query).toHaveBeenCalledWith(
      'SELECT pg_try_advisory_xact_lock($1) AS locked',
      [1_230_196_308],
    );
    expect(h.query).toHaveBeenCalledTimes(9);
    expect(h.save).toHaveBeenCalledWith(
      expect.objectContaining({
        isDemoUser: true,
        isDemoSeed: false,
        profilePictureUrl: undefined,
        postsCount: 0,
        followerCount: 0,
        followingCount: 0,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({ accessToken: 'demo-token', isDemoUser: true }),
    );
  });

  it('refuses immediately when the shared fixture lock is busy', async () => {
    const h = buildHarness();
    h.query.mockResolvedValueOnce([{ locked: false }]);
    await expect(h.service.createSession()).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(h.save).not.toHaveBeenCalled();
  });

  it('refuses a boundary record limit without mutating retained state', async () => {
    const h = buildHarness({ recordLimit: '161', retained: 161 });
    await expect(h.service.createSession()).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(h.save).not.toHaveBeenCalled();
  });

  it('serializes concurrent entries through the transaction boundary and applies the second capacity check', async () => {
    let retained = 20;
    const h = buildHarness({ recordLimit: '21' });
    let countIndex = 0;
    h.query.mockImplementation(async (sql: string) => {
      if (sql.includes('pg_try_advisory_xact_lock')) {
        countIndex = 0;
        return [{ locked: true }];
      }
      const count = countIndex === 0 ? retained : 0;
      countIndex += 1;
      return [{ count: String(count) }];
    });
    h.save.mockImplementation(async (user: User) => {
      retained += 1;
      return {
        ...user,
        tokenVersion: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as User;
    });
    const [first, second] = await Promise.allSettled([
      h.service.createSession(),
      h.service.createSession(),
    ]);
    expect(first.status).toBe('fulfilled');
    expect(second.status).toBe('rejected');
    expect(h.save).toHaveBeenCalledTimes(1);
  });
});
