import { DataSource } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { randomUUID } from 'crypto';
import argon2 from 'argon2';
import { AuthService } from '../auth/auth.service';
import { RegisterDto } from '../auth/dto/register.dto';
import { CreatePostDto } from '../posts/dto/create-post.dto';
import { PostsService } from '../posts/posts.service';
import { MediaService } from '../media/media.service';
import { MediaUpload } from '../media/entities/media-upload.entity';
import { User } from '../users/entities/user.entity';
import { Post } from '../posts/entities/post.entity';
import { Like } from '../posts/entities/like.entity';
import { Comment } from '../posts/entities/comment.entity';
import { CommentLike } from '../posts/entities/comment-like.entity';
import { Follow } from '../follows/entities/follow.entity';
import { Notification } from '../notifications/entities/notification.entity';
import {
  CORPUS_SHA256,
  CORPUS_VERSION,
  FixtureActor,
  FixturePost,
  fixturePosts,
  loadCuratedCorpus,
  readCorpusPhoto,
} from './curated-corpus';

export const FIXTURE_DATA_LOCK = 1230196308;
export const RECORD_ENTITIES = [
  User,
  Post,
  Like,
  Comment,
  CommentLike,
  Follow,
  Notification,
  MediaUpload,
];

export type FixtureDependencies = {
  database: DataSource;
  auth: AuthService;
  posts: PostsService;
  media: MediaService;
  storageOrigin: string;
  recordLimit: number;
};

async function existingActor(
  deps: FixtureDependencies,
  expected: FixtureActor,
  password: string,
) {
  const rows = await deps.database.getRepository(User).find({
    where: [
      { id: expected.id },
      { username: expected.username },
      { email: expected.email },
    ],
  });
  if (!rows.length) return false;
  const row = rows[0];
  if (
    rows.length !== 1 ||
    row.id !== expected.id ||
    row.username !== expected.username ||
    row.email !== expected.email ||
    row.fullName !== expected.fullName ||
    row.isDemoUser !== expected.isDemoUser ||
    row.isDemoSeed !== Boolean(expected.isDemoSeed) ||
    (row.bio ?? '') !== (expected.bio ?? '') ||
    row.profilePictureUrl ||
    row.demoExpiresAt
  )
    throw new Error('Fixture user conflicts with retained data');
  if (
    !expected.isDemoSeed &&
    !(await argon2.verify(row.hashedPassword, password))
  )
    throw new Error('Fixture credential differs from retained user');
  return true;
}

export async function verifyFixturePost(
  deps: FixtureDependencies,
  expected: FixturePost,
) {
  const post = await deps.database
    .getRepository(Post)
    .findOne({ where: { id: expected.id } });
  if (!post) throw new Error('Fixture post is missing');
  if (post.authorId !== expected.authorId || post.content !== expected.content)
    throw new Error('Fixture post conflicts with retained data');
  if (!expected.photo || !expected.uploadId) {
    if (post.mediaUrl) throw new Error('Text fixture has unexpected media');
    return { postId: post.id, authorId: post.authorId, content: post.content };
  }
  const upload = await deps.database.getRepository(MediaUpload).findOne({
    where: {
      id: expected.uploadId,
      ownerId: expected.authorId,
      postId: expected.id,
    },
  });
  if (
    !upload ||
    upload.pendingKey !== `pending/${expected.authorId}/${expected.uploadId}` ||
    upload.expectedBytes !== expected.photo.original.bytes ||
    upload.expectedContentType !== expected.photo.original.mime
  )
    throw new Error('Fixture upload identity differs');
  const object = await deps.media.verifyBoundPublication(
    expected.authorId,
    expected.uploadId,
  );
  if (
    object.postId !== expected.id ||
    post.mediaUrl !== object.url ||
    (post.mediaAltText != null &&
      post.mediaAltText !== expected.photo.altText) ||
    object.checksum !== expected.photo.validated.sha256 ||
    object.bytes !== expected.photo.validated.bytes ||
    object.contentType !== expected.photo.validated.contentType
  )
    throw new Error('Fixture publication differs from reviewed bytes');
  return { ...object, content: post.content };
}

export async function runFixtureOperation(
  deps: FixtureDependencies,
  action: 'apply' | 'verify',
  password: string,
) {
  if (
    !Number.isSafeInteger(deps.recordLimit) ||
    deps.recordLimit < 1 ||
    deps.recordLimit > 1000
  )
    throw new Error('Invalid fixture record budget');
  const corpus = loadCuratedCorpus();
  const actors = [...corpus.actors, ...corpus.demoSeeds];
  const posts = fixturePosts(corpus);
  const originals = new Map(
    corpus.photos.map((photo) => [photo.id, readCorpusPhoto(photo)]),
  );
  const registrations = new Map<string, RegisterDto>();
  for (const actor of actors) {
    const dto = plainToInstance(RegisterDto, {
      email: actor.email,
      username: actor.username,
      fullName: actor.fullName,
      password: actor.isDemoSeed ? `Aa1${randomUUID()}` : password,
    });
    await validateOrReject(dto);
    registrations.set(actor.id, dto);
  }
  for (const post of posts)
    await validateOrReject(
      plainToInstance(CreatePostDto, {
        content: post.content,
        mediaAltText: post.photo?.altText,
        mediaUploadId: post.uploadId,
      }),
    );

  const lock = deps.database.createQueryRunner();
  await lock.connect();
  let locked = false;
  try {
    const rows = await lock.query(
      'SELECT pg_try_advisory_lock($1::bigint) AS locked',
      [FIXTURE_DATA_LOCK],
    );
    locked = rows[0]?.locked === true;
    if (!locked) throw new Error('Another fixture or demo mutation is active');

    const presentActors = new Set<string>();
    for (const actor of actors)
      if (await existingActor(deps, actor, password))
        presentActors.add(actor.id);
    const presentPosts = new Set<string>();
    for (const post of posts) {
      if (
        await deps.database
          .getRepository(Post)
          .exists({ where: { id: post.id } })
      ) {
        await verifyFixturePost(deps, post);
        presentPosts.add(post.id);
      } else if (
        post.uploadId &&
        (await deps.database
          .getRepository(MediaUpload)
          .exists({ where: { id: post.uploadId } }))
      ) {
        throw new Error('Retained unbound fixture intent requires inspection');
      }
    }
    const missingActors = actors.filter(
      (actor) => !presentActors.has(actor.id),
    );
    const missingPosts = posts.filter((post) => !presentPosts.has(post.id));
    if (action === 'verify' && (missingActors.length || missingPosts.length))
      throw new Error('Fixture is incomplete');

    const retained = (
      await Promise.all(
        RECORD_ENTITIES.map((entity) =>
          deps.database.getRepository(entity).count(),
        ),
      )
    ).reduce((sum, count) => sum + count, 0);
    const uploadCount = await deps.database.getRepository(MediaUpload).count();
    const newUploads = missingPosts.filter((post) => post.photo).length;
    if (
      retained + missingActors.length + missingPosts.length + newUploads >
        deps.recordLimit ||
      uploadCount + newUploads > 100
    )
      throw new Error('Fixture exceeds the retained data budget');

    if (action === 'apply') {
      for (const actor of missingActors)
        await deps.auth.registerFixture(
          registrations.get(actor.id)!,
          actor.id,
          Boolean(actor.isDemoSeed),
          actor.bio,
        );
      for (const post of missingPosts) {
        if (post.photo && post.uploadId) {
          const intent = await deps.media.createFixtureUploadUrl(
            {
              userId: post.authorId,
              fileName: post.photo.original.fileName,
              contentType: post.photo.original.mime,
              contentLength: post.photo.original.bytes,
            },
            post.uploadId,
          );
          if (
            intent.uploadId !== post.uploadId ||
            new URL(intent.uploadUrl).origin !== deps.storageOrigin
          )
            throw new Error('Fixture upload target differs');
          const response = await fetch(intent.uploadUrl, {
            method: 'PUT',
            headers: {
              'content-type': post.photo.original.mime,
              'content-length': String(post.photo.original.bytes),
            },
            body: new Uint8Array(originals.get(post.photo.id)!),
            signal: AbortSignal.timeout(15_000),
            redirect: 'error',
          });
          if (!response.ok)
            throw new Error('Fixture upload failed; intent retained');
          await response.body?.cancel();
        }
        await deps.posts.createFixturePost(
          post.authorId,
          {
            content: post.content,
            mediaAltText: post.photo?.altText,
            mediaUploadId: post.uploadId,
          },
          post.id,
        );
        await verifyFixturePost(deps, post);
      }
    }
    return {
      version: CORPUS_VERSION,
      corpusSha256: CORPUS_SHA256,
      createdActors: action === 'apply' ? missingActors.length : 0,
      createdPosts: action === 'apply' ? missingPosts.length : 0,
      posts: await Promise.all(
        posts.map((post) => verifyFixturePost(deps, post)),
      ),
    };
  } finally {
    try {
      if (locked)
        await lock.query('SELECT pg_advisory_unlock($1::bigint)', [
          FIXTURE_DATA_LOCK,
        ]);
    } finally {
      await lock.release();
    }
  }
}
