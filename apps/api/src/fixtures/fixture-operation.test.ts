import argon2 from 'argon2';
import { DataSource } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { MediaService } from '../media/media.service';
import { MediaUpload } from '../media/entities/media-upload.entity';
import { Post } from '../posts/entities/post.entity';
import { PostsService } from '../posts/posts.service';
import { User } from '../users/entities/user.entity';
import {
  FIXTURE_DATA_LOCK,
  FixtureDependencies,
  runFixtureOperation,
  verifyFixturePost,
} from './fixture-operation';
import { FixturePost, fixturePosts, loadCuratedCorpus } from './curated-corpus';

jest.mock('argon2');

type StoredPost = Pick<
  Post,
  'id' | 'authorId' | 'content' | 'mediaUrl' | 'mediaAltText'
>;
type StoredUpload = Pick<
  MediaUpload,
  | 'id'
  | 'ownerId'
  | 'postId'
  | 'pendingKey'
  | 'expectedBytes'
  | 'expectedContentType'
  | 'publishedKey'
>;

type Harness = {
  deps: FixtureDependencies;
  actors: Map<string, User>;
  posts: Map<string, StoredPost>;
  uploads: Map<string, StoredUpload>;
  query: jest.Mock;
  release: jest.Mock;
  register: jest.Mock;
  createIntent: jest.Mock;
  createPost: jest.Mock;
  verify: jest.Mock;
};

const corpus = loadCuratedCorpus();
const posts = fixturePosts(corpus);

it('refuses a demo post whose reviewed photo identity is absent', () => {
  const altered = structuredClone(corpus);
  altered.demoSeeds[0].posts[0].photoId = 'missing-photo';
  expect(() => fixturePosts(altered)).toThrow('Missing demo photo definition');
});

describe('curated corpus file refusal', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('fs');
  });

  it('refuses an indirect reviewed image path before reading bytes', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock('fs', () => ({
        ...jest.requireActual('fs'),
        realpathSync: jest.fn(() => '/redirected/image.jpg'),
      }));
      const { readCorpusPhoto } = await import('./curated-corpus');
      expect(() => readCorpusPhoto(corpus.photos[0])).toThrow(
        'Indirect image refused',
      );
    });
  });

  it('refuses image bytes that differ from the reviewed photo hash', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock('fs', () => ({
        ...jest.requireActual('fs'),
        realpathSync: jest.fn((value: string) => value),
        readFileSync: jest.fn(() => Buffer.from('wrong bytes')),
      }));
      const { readCorpusPhoto } = await import('./curated-corpus');
      expect(() => readCorpusPhoto(corpus.photos[0])).toThrow(
        'Corpus image bytes differ',
      );
    });
  });
});

function publishedUrl(post: FixturePost): string {
  return `https://storage.test/published/${post.uploadId}`;
}

function storedPhotoPost(post: FixturePost): StoredPost {
  return {
    id: post.id,
    authorId: post.authorId,
    content: post.content,
    mediaAltText: post.photo?.altText,
    mediaUrl: post.photo ? publishedUrl(post) : undefined,
  };
}

function storedUpload(post: FixturePost): StoredUpload {
  if (!post.photo || !post.uploadId)
    throw new Error('Expected photo fixture post');
  return {
    id: post.uploadId,
    ownerId: post.authorId,
    postId: post.id,
    pendingKey: `pending/${post.authorId}/${post.uploadId}`,
    expectedBytes: post.photo.original.bytes,
    expectedContentType: post.photo.original.mime,
    publishedKey: `published/${post.uploadId}`,
  };
}

function buildHarness(
  options: {
    matching?: boolean;
    retained?: number;
    uploadCount?: number;
    lock?: boolean;
  } = {},
): Harness {
  const actors = new Map<string, User>();
  const storedPosts = new Map<string, StoredPost>();
  const uploads = new Map<string, StoredUpload>();
  if (options.matching) {
    for (const actor of [...corpus.actors, ...corpus.demoSeeds]) {
      actors.set(actor.id, {
        ...actor,
        hashedPassword: 'fixture-password',
        postsCount: 0,
        followerCount: 0,
        followingCount: 0,
        tokenVersion: 0,
        isDemoSeed: Boolean(actor.isDemoSeed),
        profilePictureUrl: undefined,
        demoExpiresAt: null,
      } as User);
    }
    for (const post of posts) {
      storedPosts.set(post.id, storedPhotoPost(post));
      if (post.photo) uploads.set(post.uploadId!, storedUpload(post));
    }
  }

  const register = jest.fn();
  const createIntent = jest.fn(
    async (params: { userId: string }, uploadId: string) => ({
      uploadId,
      uploadUrl: `https://storage.test/pending/${params.userId}/${uploadId}`,
    }),
  );
  const createPost = jest.fn(
    async (
      authorId: string,
      input: { content: string; mediaUploadId?: string },
      id: string,
    ) => {
      const post = posts.find((candidate) => candidate.id === id);
      if (!post) throw new Error('Unexpected fixture post');
      storedPosts.set(id, storedPhotoPost(post));
      if (post.photo) uploads.set(post.uploadId!, storedUpload(post));
      return { id, authorId, content: input.content };
    },
  );
  const verify = jest.fn(async (ownerId: string, uploadId: string) => {
    const post = posts.find((candidate) => candidate.uploadId === uploadId);
    if (!post?.photo) throw new Error('Unexpected upload verification');
    return {
      postId: post.id,
      url: publishedUrl(post),
      checksum: post.photo.validated.sha256,
      bytes: post.photo.validated.bytes,
      contentType: post.photo.validated.contentType,
      ownerId,
    };
  });

  const userRepository = {
    find: jest.fn(async ({ where }: { where: Array<{ id?: string }> }) => {
      const id = where[0]?.id;
      const user = id ? actors.get(id) : undefined;
      return user ? [user] : [];
    }),
    count: jest.fn(async () => options.retained ?? 0),
  };
  const postRepository = {
    exists: jest.fn(async ({ where }: { where: { id: string } }) =>
      storedPosts.has(where.id),
    ),
    findOne: jest.fn(
      async ({ where }: { where: { id: string } }) =>
        storedPosts.get(where.id) ?? null,
    ),
    count: jest.fn(async () => options.retained ?? 0),
  };
  const uploadRepository = {
    exists: jest.fn(async ({ where }: { where: { id: string } }) =>
      uploads.has(where.id),
    ),
    findOne: jest.fn(
      async ({ where }: { where: { id: string } }) =>
        uploads.get(where.id) ?? null,
    ),
    count: jest.fn(async () => options.uploadCount ?? 0),
  };
  const genericRepository = {
    count: jest.fn(async () => options.retained ?? 0),
  };
  const repositoryFor = (entity: unknown): unknown => {
    if (entity === User) return userRepository;
    if (entity === Post) return postRepository;
    if (entity === MediaUpload) return uploadRepository;
    return genericRepository;
  };
  const query = jest.fn(async () => [{ locked: options.lock ?? true }]);
  const release = jest.fn(async () => undefined);
  const database = {
    getRepository: repositoryFor,
    createQueryRunner: () => ({
      connect: jest.fn(async () => undefined),
      query,
      release,
    }),
  } as unknown as DataSource;
  const deps = {
    database,
    auth: { registerFixture: register } as unknown as AuthService,
    posts: { createFixturePost: createPost } as unknown as PostsService,
    media: {
      createFixtureUploadUrl: createIntent,
      verifyBoundPublication: verify,
    } as unknown as MediaService,
    storageOrigin: 'https://storage.test',
    recordLimit: 1000,
  };
  return {
    deps,
    actors,
    posts: storedPosts,
    uploads,
    query,
    release,
    register,
    createIntent,
    createPost,
    verify,
  };
}

describe('fixture operation', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (argon2.verify as jest.Mock).mockResolvedValue(true);
    (global.fetch as jest.Mock | undefined) = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('verifies the fixed text post without treating it as media', async () => {
    const h = buildHarness({ matching: true });
    const text = posts.find((post) => !post.photo)!;
    await expect(verifyFixturePost(h.deps, text)).resolves.toEqual({
      postId: text.id,
      authorId: text.authorId,
      content: text.content,
    });
    expect(h.verify).not.toHaveBeenCalled();
  });

  it('verifies an exact repeat without writes and checks every bound publication', async () => {
    const h = buildHarness({ matching: true });
    const result = await runFixtureOperation(
      h.deps,
      'apply',
      'Aa1fixturePassword',
    );
    expect(result.createdActors).toBe(0);
    expect(result.createdPosts).toBe(0);
    expect(h.register).not.toHaveBeenCalled();
    expect(h.createIntent).not.toHaveBeenCalled();
    expect(h.createPost).not.toHaveBeenCalled();
    expect(h.verify).toHaveBeenCalledTimes(18);
  });

  it.each([
    [
      'user',
      (h: Harness) => {
        const actor = corpus.actors[0];
        h.actors.set(actor.id, {
          ...h.actors.get(actor.id)!,
          username: 'conflict',
        });
      },
    ],
    [
      'post',
      (h: Harness) => {
        const post = posts[0];
        h.posts.set(post.id, { ...h.posts.get(post.id)!, content: 'conflict' });
      },
    ],
    [
      'publication hash',
      (h: Harness) => {
        h.verify.mockResolvedValueOnce({
          postId: posts[0].id,
          url: publishedUrl(posts[0]),
          checksum: '0'.repeat(64),
          bytes: 1,
          contentType: 'image/jpeg',
        });
      },
    ],
  ])('aborts %s conflicts before any write', async (_name, mutate) => {
    const h = buildHarness({ matching: true });
    mutate(h);
    await expect(
      runFixtureOperation(h.deps, 'apply', 'Aa1fixturePassword'),
    ).rejects.toThrow(/conflict|differs/i);
    expect(h.register).not.toHaveBeenCalled();
    expect(h.createIntent).not.toHaveBeenCalled();
    expect(h.createPost).not.toHaveBeenCalled();
  });

  it('refuses a retained unbound intent before writes', async () => {
    const h = buildHarness();
    h.uploads.set(posts[0].uploadId!, storedUpload(posts[0]));
    await expect(
      runFixtureOperation(h.deps, 'apply', 'Aa1fixturePassword'),
    ).rejects.toThrow('unbound fixture intent');
    expect(h.register).not.toHaveBeenCalled();
    expect(h.createPost).not.toHaveBeenCalled();
  });

  it.each([
    ['combined record limit', { retained: 991, uploadCount: 0 }],
    ['upload intent limit', { retained: 0, uploadCount: 92 }],
  ])('refuses insufficient %s before writes', async (_name, values) => {
    const h = buildHarness(values);
    await expect(
      runFixtureOperation(h.deps, 'apply', 'Aa1fixturePassword'),
    ).rejects.toThrow('budget');
    expect(h.register).not.toHaveBeenCalled();
    expect(h.createIntent).not.toHaveBeenCalled();
    expect(h.createPost).not.toHaveBeenCalled();
  });

  it('creates four actors, ten posts and nine validated uploads on an empty fixture', async () => {
    const h = buildHarness();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      body: { cancel: jest.fn(async () => undefined) },
    });
    const result = await runFixtureOperation(
      h.deps,
      'apply',
      'Aa1fixturePassword',
    );
    expect(result).toMatchObject({ createdActors: 4, createdPosts: 10 });
    expect(h.register).toHaveBeenCalledTimes(4);
    expect(h.createIntent).toHaveBeenCalledTimes(9);
    expect(h.createPost).toHaveBeenCalledTimes(10);
    expect(h.verify).toHaveBeenCalledTimes(18);
    expect(global.fetch).toHaveBeenCalledTimes(9);
    expect(h.createPost).toHaveBeenCalledWith(
      posts[0].authorId,
      expect.objectContaining({ mediaUploadId: posts[0].uploadId }),
      posts[0].id,
    );
  });

  it('retains a created intent and does not create a post when PUT fails', async () => {
    const h = buildHarness();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      body: { cancel: jest.fn() },
    });
    await expect(
      runFixtureOperation(h.deps, 'apply', 'Aa1fixturePassword'),
    ).rejects.toThrow('intent retained');
    expect(h.createIntent).toHaveBeenCalledTimes(1);
    expect(h.createPost).not.toHaveBeenCalled();
  });

  it('refuses a busy lock and releases the query runner', async () => {
    const h = buildHarness({ lock: false });
    await expect(
      runFixtureOperation(h.deps, 'apply', 'Aa1fixturePassword'),
    ).rejects.toThrow('Another fixture');
    expect(h.release).toHaveBeenCalledTimes(1);
    expect(h.query).toHaveBeenCalledWith(
      'SELECT pg_try_advisory_lock($1::bigint) AS locked',
      [FIXTURE_DATA_LOCK],
    );
  });

  it('unlocks and releases after an error following lock acquisition', async () => {
    const h = buildHarness({ matching: true });
    h.verify.mockRejectedValueOnce(new Error('verification failure'));
    await expect(
      runFixtureOperation(h.deps, 'verify', 'Aa1fixturePassword'),
    ).rejects.toThrow('verification failure');
    expect(h.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_unlock($1::bigint)',
      [FIXTURE_DATA_LOCK],
    );
    expect(h.release).toHaveBeenCalledTimes(1);
  });
});
