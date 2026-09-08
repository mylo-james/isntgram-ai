import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { EntityManager, Repository } from 'typeorm';
import {
  fixturePosts,
  loadCuratedCorpus,
  readCorpusPhoto,
  type Corpus,
} from '../../fixtures/curated-corpus';
import { MediaUpload } from '../../media/entities/media-upload.entity';
import { MediaService } from '../../media/media.service';
import { Post } from '../../posts/entities/post.entity';
import { User } from '../../users/entities/user.entity';
import { PrivateUserProfileDto } from '../../users/dto/private-user-profile.dto';
import { AuthService } from '../auth.service';

const APP_TABLES = [
  'users',
  'posts',
  'follows',
  'likes',
  'comments',
  'comment_likes',
  'notifications',
  'media_uploads',
] as const;
const CURATED_DEMO_LOCK = 1_230_196_308;

export type CuratedDemoSession = {
  user: PrivateUserProfileDto;
  accessToken: string;
  isDemoUser: true;
  demoExpiresAt: string;
};

@Injectable()
export class CuratedDemoService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
    private readonly mediaService: MediaService,
  ) {}

  async createSession(): Promise<CuratedDemoSession> {
    this.assertEnabled();
    const recordLimit = this.getRecordLimit();
    const ttlHours = this.getDemoTtlHours();
    const corpus = loadCuratedCorpus();
    for (const photo of corpus.photos) readCorpusPhoto(photo);
    const verifiedKeys = new Map<string, string>();
    // Storage reads stay outside the database transaction. Binding checks below
    // then require the exact keys verified here before inserting a visitor.
    await Promise.all(
      corpus.demoSeeds.flatMap((seed) =>
        seed.posts.map(async (post) => {
          const photo = corpus.photos.find((item) => item.id === post.photoId);
          if (!photo) throw new ConflictException('Curated photo is missing');
          const object = await this.mediaService.verifyBoundPublication(
            seed.id,
            post.uploadId,
          );
          if (
            object.postId !== post.id ||
            object.checksum !== photo.validated.sha256 ||
            object.bytes !== photo.validated.bytes ||
            object.contentType !== photo.validated.contentType
          )
            throw new ConflictException('Curated published photo differs');
          verifiedKeys.set(post.uploadId, object.key);
        }),
      ),
    );

    const created = await this.userRepository.manager.transaction(
      async (manager) => {
        const lock = await manager.query(
          'SELECT pg_try_advisory_xact_lock($1) AS locked',
          [CURATED_DEMO_LOCK],
        );
        if ((lock as Array<{ locked?: unknown }>)[0]?.locked !== true) {
          throw new ConflictException(
            'Curated fixture operation is already in progress',
          );
        }
        await this.assertCorpusBindings(manager, corpus, verifiedKeys);
        await this.assertRecordCapacity(manager, recordLimit);

        const id = randomUUID();
        const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
        const user = manager.getRepository(User).create({
          id,
          email: `demo_${id}@demo.isntgram.local`,
          username: `demo_${id.replace(/-/g, '').slice(0, 12)}`,
          fullName: `Demo ${id.replace(/-/g, '').slice(0, 12)}`,
          hashedPassword: await argon2.hash(randomUUID(), {
            type: argon2.argon2id,
          }),
          postsCount: 0,
          followerCount: 0,
          followingCount: 0,
          isDemoUser: true,
          isDemoSeed: false,
          demoExpiresAt: expiresAt,
          profilePictureUrl: undefined,
          bio: 'Fictional local demo visitor. Curated content is clearly labeled.',
        });
        return manager.getRepository(User).save(user);
      },
    );

    const accessToken = await this.authService.signAccessToken(created);
    return {
      user: this.authService.toSafeUser(created),
      accessToken,
      isDemoUser: true,
      demoExpiresAt: created.demoExpiresAt?.toISOString() ?? '',
    };
  }

  private assertEnabled(): void {
    if (this.configService.get<string>('DEMO_ENABLED') !== 'true') {
      throw new ForbiddenException('Demo mode disabled');
    }
    if (this.configService.get<string>('DEMO_CONTENT_SOURCE') !== 'curated') {
      throw new ForbiddenException('Curated demo content is required');
    }
  }

  private getRecordLimit(): number {
    const raw = this.configService.get<string>('DEMO_RECORD_LIMIT');
    if (!raw || !/^\d+$/.test(raw)) {
      throw new ConflictException(
        'DEMO_RECORD_LIMIT must be an integer from 1 to 1000',
      );
    }
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 1 || value > 1000) {
      throw new ConflictException(
        'DEMO_RECORD_LIMIT must be an integer from 1 to 1000',
      );
    }
    return value;
  }

  private getDemoTtlHours(): number {
    const raw = this.configService.get<string>('DEMO_TTL_HOURS') || '48';
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return 48;
    return Math.max(1, Math.floor(parsed));
  }

  private async assertRecordCapacity(
    manager: EntityManager,
    recordLimit: number,
  ): Promise<void> {
    let retained = 0;
    for (const table of APP_TABLES) {
      const rows = await manager.query(
        `SELECT count(*)::text AS count FROM ${table}`,
      );
      const count = Number((rows as Array<{ count?: unknown }>)[0]?.count);
      if (!Number.isSafeInteger(count) || count < 0) {
        throw new ConflictException(
          `Unable to count retained ${table} records`,
        );
      }
      retained += count;
      if (!Number.isSafeInteger(retained)) {
        throw new ConflictException('Retained record count is unsafe');
      }
    }
    if (retained + 1 > recordLimit) {
      throw new ConflictException('Demo record limit reached');
    }
  }

  private async assertCorpusBindings(
    manager: EntityManager,
    corpus: Corpus,
    verifiedKeys: ReadonlyMap<string, string>,
  ): Promise<void> {
    if (
      corpus.demoSeeds.length !== 2 ||
      corpus.demoSeeds.some((seed) => seed.posts.length !== 3)
    ) {
      throw new ConflictException(
        'Curated demo corpus must define exactly two seeds with three posts each',
      );
    }

    const users = manager.getRepository(User);
    const posts = manager.getRepository(Post);
    const uploads = manager.getRepository(MediaUpload);
    const expectedPosts = fixturePosts(corpus).filter((post) =>
      corpus.demoSeeds.some((seed) => seed.id === post.authorId),
    );
    if (
      expectedPosts.length !== 6 ||
      new Set(expectedPosts.map((post) => post.id)).size !== 6
    ) {
      throw new ConflictException(
        'Curated demo corpus must define six unique demo posts',
      );
    }
    for (const seed of corpus.demoSeeds) {
      const user = await users.findOne({ where: { id: seed.id } });
      if (
        !user ||
        user.username !== seed.username ||
        user.fullName !== seed.fullName ||
        user.email !== seed.email ||
        user.isDemoUser !== true ||
        user.isDemoSeed !== true ||
        (user.bio ?? null) !== (seed.bio ?? null)
      ) {
        throw new ConflictException(
          `Curated demo seed binding is missing or conflicts: ${seed.id}`,
        );
      }

      const postCount = await posts.count({ where: { authorId: seed.id } });
      if (postCount !== seed.posts.length) {
        throw new ConflictException(
          `Curated demo post count conflicts: ${seed.id}`,
        );
      }

      for (const seedPost of seed.posts) {
        const photo = corpus.photos.find(
          (candidate) => candidate.id === seedPost.photoId,
        );
        if (!photo)
          throw new ConflictException(
            `Curated photo definition is missing: ${seedPost.photoId}`,
          );
        const post = await posts.findOne({ where: { id: seedPost.id } });
        const upload = await uploads.findOne({
          where: { id: seedPost.uploadId },
        });
        const expectedUrl = this.publishedUrl(upload?.publishedKey);
        if (
          !post ||
          !upload ||
          post.authorId !== seed.id ||
          post.content !== photo.caption ||
          post.mediaUrl !== expectedUrl ||
          upload.ownerId !== seed.id ||
          upload.postId !== seedPost.id ||
          upload.expectedBytes !== photo.original.bytes ||
          upload.expectedContentType !== photo.original.mime ||
          upload.publishedChecksum !== photo.validated.sha256 ||
          upload.publishedBytes !== photo.validated.bytes ||
          upload.publishedContentType !== photo.validated.contentType ||
          !upload.publishedKey ||
          upload.publishedKey !== verifiedKeys.get(seedPost.uploadId)
        ) {
          throw new ConflictException(
            `Curated demo post binding is missing or conflicts: ${seedPost.id}`,
          );
        }
      }
    }
  }

  private publishedUrl(
    publishedKey: string | null | undefined,
  ): string | undefined {
    if (!publishedKey) return undefined;
    const base = this.configService.get<string>('S3_PUBLIC_BASE_URL');
    if (!base) return undefined;
    return `${base.replace(/\/$/, '')}/${publishedKey}`;
  }
}
