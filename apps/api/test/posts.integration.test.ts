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
import { Follow } from '../src/follows/entities/follow.entity';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ConfigModule } from '@nestjs/config';

describe('Posts Integration Tests', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let postRepository: Repository<Post>;
  let followRepository: Repository<Follow>;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-jwt-secret';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [User, Post, Follow],
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
    await app.init();

    userRepository = moduleFixture.get<Repository<User>>(
      getRepositoryToken(User),
    );
    postRepository = moduleFixture.get<Repository<Post>>(
      getRepositoryToken(Post),
    );
    followRepository = moduleFixture.get<Repository<Follow>>(
      getRepositoryToken(Follow),
    );
  });

  beforeEach(async () => {
    // Ensure tests are isolated.
    await followRepository.clear();
    await postRepository.clear();
    await userRepository.clear();
  });

  afterAll(async () => {
    await app.close();
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
});
