import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { PostsModule } from '../src/posts/posts.module';
import { FollowsModule } from '../src/follows/follows.module';
import { User } from '../src/users/entities/user.entity';
import { Post } from '../src/posts/entities/post.entity';
import { Like } from '../src/posts/entities/like.entity';
import { Comment } from '../src/posts/entities/comment.entity';
import { CommentLike } from '../src/posts/entities/comment-like.entity';
import { Follow } from '../src/follows/entities/follow.entity';
import { Notification } from '../src/notifications/entities/notification.entity';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ConfigModule } from '@nestjs/config';
import { MediaUpload } from '../src/media/entities/media-upload.entity';
import { MediaService } from '../src/media/media.service';
import { PostsService } from '../src/posts/posts.service';
import { AuthService } from '../src/auth/auth.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { selectTestDatabase } = require('./test-database-target.cjs') as {
  selectTestDatabase: (
    env: NodeJS.ProcessEnv,
  ) => { kind: 'sqlite' } | { kind: 'postgres'; url: string };
};

describe('Posts Integration Tests', () => {
  let app: INestApplication;
  let isPostgres = false;
  let userRepository: Repository<User>;
  let postRepository: Repository<Post>;
  let followRepository: Repository<Follow>;
  let notificationRepository: Repository<Notification>;
  let likeRepository: Repository<Like>;
  let commentRepository: Repository<Comment>;
  let commentLikeRepository: Repository<CommentLike>;
  let authService: AuthService;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-jwt-secret';
    const selectedDatabase = selectTestDatabase(process.env);
    isPostgres = selectedDatabase.kind === 'postgres';
    const databaseConnection =
      selectedDatabase.kind === 'postgres'
        ? { type: 'postgres' as const, url: selectedDatabase.url }
        : { type: 'sqlite' as const, database: ':memory:' };
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          ...databaseConnection,
          entities: [
            User,
            Post,
            Like,
            Comment,
            CommentLike,
            Follow,
            Notification,
            MediaUpload,
          ],
          synchronize: true,
        }),
        ThrottlerModule.forRoot([
          {
            ttl: 60000,
            limit: 1000,
          },
        ]),
        AuthModule,
        UsersModule,
        PostsModule,
        FollowsModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    // Keep one loopback listener for the suite; Supertest must not close it per request.
    await app.listen(0, '127.0.0.1');

    userRepository = moduleFixture.get<Repository<User>>(
      getRepositoryToken(User),
    );
    postRepository = moduleFixture.get<Repository<Post>>(
      getRepositoryToken(Post),
    );
    followRepository = moduleFixture.get<Repository<Follow>>(
      getRepositoryToken(Follow),
    );
    notificationRepository = moduleFixture.get<Repository<Notification>>(
      getRepositoryToken(Notification),
    );
    likeRepository = moduleFixture.get<Repository<Like>>(
      getRepositoryToken(Like),
    );
    commentRepository = moduleFixture.get<Repository<Comment>>(
      getRepositoryToken(Comment),
    );
    commentLikeRepository = moduleFixture.get<Repository<CommentLike>>(
      getRepositoryToken(CommentLike),
    );
    authService = moduleFixture.get<AuthService>(AuthService);
  });

  beforeEach(async () => {
    if (isPostgres) {
      await userRepository.query('TRUNCATE TABLE "users" CASCADE');
      return;
    }
    // Ensure tests are isolated.
    await app
      .get<Repository<MediaUpload>>(getRepositoryToken(MediaUpload))
      .clear();
    jest.restoreAllMocks();
    await notificationRepository.clear();
    await commentLikeRepository.clear();
    await commentRepository.clear();
    await likeRepository.clear();
    await followRepository.clear();
    await postRepository.clear();
    await userRepository.clear();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  async function createActor(
    username: string,
    options: { isDemoUser?: boolean; isDemoSeed?: boolean } = {},
  ) {
    const user = await userRepository.save(
      userRepository.create({
        email: `${username}@example.invalid`,
        username,
        fullName: username,
        hashedPassword: 'not-used-by-direct-token-test',
        tokenVersion: 0,
        isDemoUser: options.isDemoUser ?? false,
        isDemoSeed: options.isDemoSeed ?? false,
        postsCount: 0,
        followerCount: 0,
        followingCount: 0,
      }),
    );
    return { user, token: await authService.signAccessToken(user) };
  }

  async function createStoredPost(
    authorId: string,
    content: string,
    mediaUrl?: string,
  ) {
    return postRepository.save(
      postRepository.create({ authorId, content, mediaUrl }),
    );
  }

  it('round-trips descriptions through publication, replay, detail, feed, explore and profile', async () => {
    const author = await createActor('description_author');
    const reader = await createActor('description_reader');
    const uploads = app.get<Repository<MediaUpload>>(
      getRepositoryToken(MediaUpload),
    );
    const intent = await uploads.save(
      uploads.create({
        ownerId: author.user.id,
        pendingKey: 'pending/test-description',
        expectedBytes: 100,
        expectedContentType: 'image/png',
        expiresAt: new Date(Date.now() + 60000),
      }),
    );
    const media = app.get(MediaService);
    const preparation = jest
      .spyOn(media, 'preparePublication')
      .mockResolvedValue({
        uploadId: intent.id,
        ownerId: author.user.id,
        publishedKey: 'published/description',
        publishedUrl: 'http://localhost/description.png',
        checksum: 'a'.repeat(64),
        contentType: 'image/png',
        bytes: 100,
        width: 10,
        height: 10,
        frames: 1,
      });
    const payload = {
      content: 'A day outside',
      mediaUploadId: intent.id,
      mediaAltText: '  A red boat on a lake  ',
    };
    const published = await request(app.getHttpServer())
      .post('/api/posts')
      .set('Authorization', `Bearer ${author.token}`)
      .send(payload)
      .expect(201);
    expect(published.body.mediaAltText).toBe('A red boat on a lake');
    expect(
      (await postRepository.findOneByOrFail({ id: published.body.id }))
        .mediaAltText,
    ).toBe('A red boat on a lake');
    const replay = await request(app.getHttpServer())
      .post('/api/posts')
      .set('Authorization', `Bearer ${author.token}`)
      .send(payload)
      .expect(201);
    expect(replay.body.id).toBe(published.body.id);
    expect(preparation).toHaveBeenCalledTimes(1);
    for (const mediaAltText of ['Different description', '', undefined]) {
      await request(app.getHttpServer())
        .post('/api/posts')
        .set('Authorization', `Bearer ${author.token}`)
        .send({ ...payload, mediaAltText })
        .expect(409);
    }
    await request(app.getHttpServer())
      .post('/api/posts')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ ...payload, content: 'Different caption' })
      .expect(409);
    await followRepository.save(
      followRepository.create({
        followerId: reader.user.id,
        followingId: author.user.id,
      }),
    );
    for (const endpoint of [
      '/api/posts/feed',
      '/api/posts/explore',
      '/api/posts/user/description_author',
    ]) {
      const response = await request(app.getHttpServer())
        .get(endpoint)
        .set('Authorization', `Bearer ${reader.token}`)
        .expect(200);
      expect(
        response.body.items.find((post: Post) => post.id === published.body.id)
          ?.mediaAltText,
      ).toBe('A red boat on a lake');
    }
    const detail = await request(app.getHttpServer())
      .get(`/api/posts/${published.body.id}`)
      .set('Authorization', `Bearer ${reader.token}`)
      .expect(200);
    expect(detail.body.mediaAltText).toBe('A red boat on a lake');
    expect(
      await postRepository.count({ where: { authorId: author.user.id } }),
    ).toBe(1);
  });

  it('should create posts and populate feed for followers', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'author@example.com',
        username: 'author',
        fullName: 'Author One',
        password: 'Password123',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'reader@example.com',
        username: 'reader',
        fullName: 'Reader Two',
        password: 'Password123',
      })
      .expect(201);

    const authorLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'author@example.com', password: 'Password123' })
      .expect(200);

    const readerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'reader@example.com', password: 'Password123' })
      .expect(200);

    const authorToken = authorLogin.body.accessToken;
    const readerToken = readerLogin.body.accessToken;

    await request(app.getHttpServer())
      .post('/api/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ content: 'Hello feed' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/follows/author')
      .set('Authorization', `Bearer ${readerToken}`)
      .expect(201);

    const feedResponse = await request(app.getHttpServer())
      .get('/api/posts/feed')
      .set('Authorization', `Bearer ${readerToken}`)
      .expect(200);

    expect(feedResponse.body.items).toHaveLength(1);
    expect(feedResponse.body.items[0].content).toBe('Hello feed');
  });

  it('should require auth for feed', async () => {
    await request(app.getHttpServer()).get('/api/posts/feed').expect(401);
  });

  it('shows curated seed posts to an empty demo visitor without fabricated follows or ordinary-data leakage', async () => {
    const previous = process.env.DEMO_CONTENT_SOURCE;
    process.env.DEMO_CONTENT_SOURCE = 'curated';
    try {
      const makeUser = (
        username: string,
        isDemoUser: boolean,
        isDemoSeed = false,
      ) =>
        userRepository.save(
          userRepository.create({
            username,
            email: `${username}@example.invalid`,
            fullName: username,
            hashedPassword: 'unused-in-query-test',
            isDemoUser,
            isDemoSeed,
          }),
        );
      const ordinary = await makeUser('ordinary_reader', false);
      const visitor = await makeUser('demo_visitor', true);
      const seed = await makeUser('demo_seed', true, true);
      const otherVisitor = await makeUser('other_visitor', true);
      for (const [author, content] of [
        [ordinary, 'ordinary private feed'],
        [seed, 'credited curated example'],
        [otherVisitor, 'another visitor post'],
      ] as const)
        await postRepository.save(
          postRepository.create({ authorId: author.id, content }),
        );
      const service = app.get(PostsService);
      const demoFeed = await service.getFeed(visitor.id, true, { limit: 20 });
      expect(demoFeed.items.map((item) => item.content)).toEqual([
        'credited curated example',
      ]);
      const ordinaryFeed = await service.getFeed(ordinary.id, false, {
        limit: 20,
      });
      expect(ordinaryFeed.items.map((item) => item.content)).toEqual([
        'ordinary private feed',
      ]);
      expect(await followRepository.count()).toBe(0);
      process.env.DEMO_CONTENT_SOURCE = 'synthetic';
      expect(
        (await service.getFeed(visitor.id, true, { limit: 20 })).items,
      ).toEqual([]);
    } finally {
      if (previous === undefined) delete process.env.DEMO_CONTENT_SOURCE;
      else process.env.DEMO_CONTENT_SOURCE = previous;
    }
  });

  it('paginates feed with cursor + limit', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'author@example.com',
        username: 'author',
        fullName: 'Author One',
        password: 'Password123',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'reader@example.com',
        username: 'reader',
        fullName: 'Reader Two',
        password: 'Password123',
      })
      .expect(201);

    const authorLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'author@example.com', password: 'Password123' })
      .expect(200);

    const readerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'reader@example.com', password: 'Password123' })
      .expect(200);

    const authorToken = authorLogin.body.accessToken as string;
    const readerToken = readerLogin.body.accessToken as string;

    // Follow author so their posts appear in reader feed.
    await request(app.getHttpServer())
      .post('/api/follows/author')
      .set('Authorization', `Bearer ${readerToken}`)
      .expect(201);

    // Create 3 posts as author.
    const createdIds: string[] = [];
    for (const content of ['p1', 'p2', 'p3']) {
      const res = await request(app.getHttpServer())
        .post('/api/posts')
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ content })
        .expect(201);
      createdIds.push(res.body.id as string);
    }

    const page1 = await request(app.getHttpServer())
      .get('/api/posts/feed?limit=2')
      .set('Authorization', `Bearer ${readerToken}`)
      .expect(200);

    expect(page1.body.items).toHaveLength(2);
    expect(typeof page1.body.nextCursor).toBe('string');

    const page1Ids = new Set<string>(page1.body.items.map((p: any) => p.id));

    const page2 = await request(app.getHttpServer())
      .get(
        `/api/posts/feed?limit=2&cursor=${encodeURIComponent(page1.body.nextCursor)}`,
      )
      .set('Authorization', `Bearer ${readerToken}`)
      .expect(200);

    expect(page2.body.nextCursor).toBeUndefined();

    const page2Ids = new Set<string>(page2.body.items.map((p: any) => p.id));
    for (const id of page2Ids) {
      expect(page1Ids.has(id)).toBe(false);
    }

    const allIds = new Set([...page1Ids, ...page2Ids]);
    expect(allIds.size).toBe(3);
    for (const id of createdIds) {
      expect(allIds.has(id)).toBe(true);
    }
  });

  it('rejects invalid cursor values', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'reader@example.com',
        username: 'reader',
        fullName: 'Reader Two',
        password: 'Password123',
      })
      .expect(201);

    const readerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'reader@example.com', password: 'Password123' })
      .expect(200);

    const readerToken = readerLogin.body.accessToken as string;

    await request(app.getHttpServer())
      .get('/api/posts/feed?cursor=not-base64!!')
      .set('Authorization', `Bearer ${readerToken}`)
      .expect(400);
  });

  it('validates limit bounds for feed query', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'reader@example.com',
        username: 'reader',
        fullName: 'Reader Two',
        password: 'Password123',
      })
      .expect(201);

    const readerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'reader@example.com', password: 'Password123' })
      .expect(200);

    const readerToken = readerLogin.body.accessToken as string;

    await request(app.getHttpServer())
      .get('/api/posts/feed?limit=0')
      .set('Authorization', `Bearer ${readerToken}`)
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/posts/feed?limit=51')
      .set('Authorization', `Bearer ${readerToken}`)
      .expect(400);
  });

  it('returns 404 for user posts when user does not exist', async () => {
    await request(app.getHttpServer())
      .get('/api/posts/user/missing')
      .expect(404);
  });

  it('paginates user posts with cursor + limit', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'author@example.com',
        username: 'author',
        fullName: 'Author One',
        password: 'Password123',
      })
      .expect(201);

    const authorLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'author@example.com', password: 'Password123' })
      .expect(200);

    const authorToken = authorLogin.body.accessToken as string;

    const createdIds: string[] = [];
    for (const content of ['p1', 'p2', 'p3']) {
      const res = await request(app.getHttpServer())
        .post('/api/posts')
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ content })
        .expect(201);
      createdIds.push(res.body.id as string);
    }

    const page1 = await request(app.getHttpServer())
      .get('/api/posts/user/author?limit=2')
      .expect(200);

    expect(page1.body.items).toHaveLength(2);
    expect(typeof page1.body.nextCursor).toBe('string');

    const page1Ids = new Set<string>(page1.body.items.map((p: any) => p.id));

    const page2 = await request(app.getHttpServer())
      .get(
        `/api/posts/user/author?limit=2&cursor=${encodeURIComponent(page1.body.nextCursor)}`,
      )
      .expect(200);

    expect(page2.body.nextCursor).toBeUndefined();

    const page2Ids = new Set<string>(page2.body.items.map((p: any) => p.id));
    for (const id of page2Ids) {
      expect(page1Ids.has(id)).toBe(false);
    }

    const allIds = new Set([...page1Ids, ...page2Ids]);
    expect(allIds.size).toBe(3);
    for (const id of createdIds) {
      expect(allIds.has(id)).toBe(true);
    }
  });

  it('explores only other media posts in the viewer domain and paginates without duplicates', async () => {
    const viewer = await createActor('explore_viewer');
    const author = await createActor('explore_author');
    const anotherAuthor = await createActor('explore_another');
    const demoAuthor = await createActor('explore_demo', {
      isDemoUser: true,
      isDemoSeed: true,
    });

    const own = await createStoredPost(
      viewer.user.id,
      'viewer media must not appear',
      'https://media.example/own.jpg',
    );
    await createStoredPost(author.user.id, 'text only must not appear');
    const expected = await Promise.all([
      createStoredPost(
        author.user.id,
        'ordinary photo one',
        'https://media.example/one.jpg',
      ),
      createStoredPost(
        anotherAuthor.user.id,
        'ordinary photo two',
        'https://media.example/two.jpg',
      ),
      createStoredPost(
        anotherAuthor.user.id,
        'ordinary photo three',
        'https://media.example/three.jpg',
      ),
    ]);
    await createStoredPost(
      demoAuthor.user.id,
      'demo photo must not leak',
      'https://media.example/demo.jpg',
    );
    await likeRepository.save(
      likeRepository.create({ postId: expected[0].id, userId: viewer.user.id }),
    );

    const first = await request(app.getHttpServer())
      .get('/api/posts/explore?limit=2')
      .set('Authorization', `Bearer ${viewer.token}`)
      .expect(200);
    const second = await request(app.getHttpServer())
      .get(
        `/api/posts/explore?limit=2&cursor=${encodeURIComponent(first.body.nextCursor as string)}`,
      )
      .set('Authorization', `Bearer ${viewer.token}`)
      .expect(200);

    const received = [...first.body.items, ...second.body.items];
    expect(first.body.nextCursor).toEqual(expect.any(String));
    expect(second.body.nextCursor).toBeUndefined();
    expect(new Set(received.map((post: { id: string }) => post.id)).size).toBe(
      3,
    );
    expect(received.map((post: { id: string }) => post.id)).toEqual(
      expect.arrayContaining(expected.map((post) => post.id)),
    );
    expect(received.map((post: { id: string }) => post.id)).not.toContain(
      own.id,
    );
    expect(received.every((post: { mediaUrl?: string }) => post.mediaUrl)).toBe(
      true,
    );
    expect(
      received.find((post: { id: string }) => post.id === expected[0].id)
        ?.likedByViewer,
    ).toBe(true);

    await request(app.getHttpServer())
      .get(`/api/posts/${expected[0].id}`)
      .set('Authorization', `Bearer ${demoAuthor.token}`)
      .expect(404);
  });

  it('returns per-post newest comment previews and viewer-specific comment-like decoration', async () => {
    const author = await createActor('preview_author');
    const viewer = await createActor('preview_viewer');
    const secondViewer = await createActor('preview_second_viewer');
    const other = await createActor('preview_other');
    const post = await createStoredPost(author.user.id, 'preview target');
    const otherPost = await createStoredPost(
      author.user.id,
      'other preview target',
    );
    const comments = [] as Comment[];
    for (const [index, content] of [
      'oldest',
      'second',
      'third',
      'newest',
    ].entries()) {
      const saved = await commentRepository.save(
        commentRepository.create({
          postId: post.id,
          authorId: other.user.id,
          content,
        }),
      );
      await commentRepository.update(
        { id: saved.id },
        { createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)) },
      );
      comments.push(await commentRepository.findOneByOrFail({ id: saved.id }));
    }
    await commentRepository.save(
      commentRepository.create({
        postId: otherPost.id,
        authorId: other.user.id,
        content: 'must stay on other post',
      }),
    );
    await commentLikeRepository.save(
      commentLikeRepository.create({
        commentId: comments[3].id,
        userId: viewer.user.id,
      }),
    );
    await followRepository.save(
      followRepository.create({
        followerId: viewer.user.id,
        followingId: author.user.id,
      }),
    );

    const detail = await request(app.getHttpServer())
      .get(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .expect(200);

    expect(detail.body.previewComments).toHaveLength(3);
    expect(
      detail.body.previewComments.map(
        (comment: { content: string }) => comment.content,
      ),
    ).toEqual(['newest', 'third', 'second']);
    expect(
      detail.body.previewComments.find(
        (comment: { id: string }) => comment.id === comments[3].id,
      ),
    ).toMatchObject({
      author: { username: other.user.username },
      likedByViewer: true,
    });
    expect(
      detail.body.previewComments.some(
        (comment: { content: string }) =>
          comment.content === 'must stay on other post',
      ),
    ).toBe(false);

    const feed = await request(app.getHttpServer())
      .get('/api/posts/feed')
      .set('Authorization', `Bearer ${viewer.token}`)
      .expect(200);
    const userPosts = await request(app.getHttpServer())
      .get(`/api/posts/user/${author.user.username}`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .expect(200);
    for (const response of [feed, userPosts]) {
      expect(
        response.body.items
          .find((item: { id: string }) => item.id === post.id)
          ?.previewComments.find(
            (comment: { id: string }) => comment.id === comments[3].id,
          ),
      ).toMatchObject({ likedByViewer: true });
    }

    const otherViewerDetail = await request(app.getHttpServer())
      .get(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${secondViewer.token}`)
      .expect(200);
    expect(
      otherViewerDetail.body.previewComments.find(
        (comment: { id: string }) => comment.id === comments[3].id,
      ),
    ).toMatchObject({ likedByViewer: false });
  });

  it('paginates comments with viewer decoration and makes comment reactions idempotent', async () => {
    const author = await createActor('comment_author');
    const commenter = await createActor('commenter');
    const viewer = await createActor('comment_viewer');
    const post = await createStoredPost(author.user.id, 'comment target');
    const created = await request(app.getHttpServer())
      .post(`/api/posts/${post.id}/comments`)
      .set('Authorization', `Bearer ${commenter.token}`)
      .send({ content: 'first visible comment' })
      .expect(201);
    const commentId = created.body.id as string;

    for (const content of ['second visible comment', 'third visible comment']) {
      await request(app.getHttpServer())
        .post(`/api/posts/${post.id}/comments`)
        .set('Authorization', `Bearer ${commenter.token}`)
        .send({ content })
        .expect(201);
    }

    const firstLike = await request(app.getHttpServer())
      .post(`/api/posts/${post.id}/comments/${commentId}/like`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .expect(201);
    const repeatLike = await request(app.getHttpServer())
      .post(`/api/posts/${post.id}/comments/${commentId}/like`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .expect(201);
    expect(firstLike.body).toEqual({ isLiked: true, likeCount: 1 });
    expect(repeatLike.body).toEqual({ isLiked: true, likeCount: 1 });

    const pageOne = await request(app.getHttpServer())
      .get(`/api/posts/${post.id}/comments?limit=2`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .expect(200);
    const pageTwo = await request(app.getHttpServer())
      .get(
        `/api/posts/${post.id}/comments?limit=2&cursor=${encodeURIComponent(pageOne.body.nextCursor as string)}`,
      )
      .set('Authorization', `Bearer ${viewer.token}`)
      .expect(200);
    const returned = [...pageOne.body.items, ...pageTwo.body.items];
    expect(
      new Set(returned.map((comment: { id: string }) => comment.id)).size,
    ).toBe(3);
    expect(
      returned.find((comment: { id: string }) => comment.id === commentId),
    ).toMatchObject({ likedByViewer: true, likeCount: 1 });

    const firstUnlike = await request(app.getHttpServer())
      .delete(`/api/posts/${post.id}/comments/${commentId}/like`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .expect(200);
    const repeatUnlike = await request(app.getHttpServer())
      .delete(`/api/posts/${post.id}/comments/${commentId}/like`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .expect(200);
    expect(firstUnlike.body).toEqual({ isLiked: false, likeCount: 0 });
    expect(repeatUnlike.body).toEqual({ isLiked: false, likeCount: 0 });
    expect(await commentLikeRepository.count()).toBe(0);
    expect(await postRepository.findOneByOrFail({ id: post.id })).toMatchObject(
      {
        commentCount: 3,
      },
    );
    expect(
      await notificationRepository.find({
        where: { recipientId: author.user.id, type: 'comment' },
      }),
    ).toHaveLength(3);
  });

  it('makes post reactions idempotent through the HTTP boundary without inflating counters or notifications', async () => {
    const author = await createActor('post_reaction_author');
    const viewer = await createActor('post_reaction_viewer');
    const post = await createStoredPost(author.user.id, 'post reaction target');

    const firstLike = await request(app.getHttpServer())
      .post(`/api/posts/${post.id}/like`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .expect(201);
    const repeatedLike = await request(app.getHttpServer())
      .post(`/api/posts/${post.id}/like`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .expect(201);
    expect(firstLike.body).toEqual({ isLiked: true, likeCount: 1 });
    expect(repeatedLike.body).toEqual({ isLiked: true, likeCount: 1 });
    expect(await likeRepository.count({ where: { postId: post.id } })).toBe(1);
    expect(await postRepository.findOneByOrFail({ id: post.id })).toMatchObject(
      { likeCount: 1 },
    );
    expect(
      await notificationRepository.find({
        where: { recipientId: author.user.id, type: 'like', postId: post.id },
      }),
    ).toHaveLength(1);

    const firstUnlike = await request(app.getHttpServer())
      .delete(`/api/posts/${post.id}/like`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .expect(200);
    const repeatedUnlike = await request(app.getHttpServer())
      .delete(`/api/posts/${post.id}/like`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .expect(200);
    expect(firstUnlike.body).toEqual({ isLiked: false, likeCount: 0 });
    expect(repeatedUnlike.body).toEqual({ isLiked: false, likeCount: 0 });
    expect(await likeRepository.count({ where: { postId: post.id } })).toBe(0);
    expect(await postRepository.findOneByOrFail({ id: post.id })).toMatchObject(
      { likeCount: 0 },
    );
    expect(
      await notificationRepository.find({
        where: { recipientId: author.user.id, type: 'like', postId: post.id },
      }),
    ).toHaveLength(1);
  });
});
