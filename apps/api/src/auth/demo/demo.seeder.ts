import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import argon2 from 'argon2';
import { createHash, randomUUID } from 'crypto';
import { In, Repository } from 'typeorm';
import { isUniqueConstraintError } from '../../common/db-errors';
import { Follow } from '../../follows/entities/follow.entity';
import { Notification } from '../../notifications/entities/notification.entity';
import { CommentLike } from '../../posts/entities/comment-like.entity';
import { Comment } from '../../posts/entities/comment.entity';
import { Like } from '../../posts/entities/like.entity';
import { Post } from '../../posts/entities/post.entity';
import { User } from '../../users/entities/user.entity';
import {
  DEMO_NOTIFICATION_COMMENT_TEMPLATES,
  DEMO_SEED_FOLLOW_FRACTION,
  DEMO_SEED_FOLLOW_MIN,
  DEMO_SEED_POSTS_PER_USER,
  DEMO_SEED_POST_TEMPLATES,
  DEMO_SEED_USERS,
  DEMO_USER_INITIAL_POSTS,
} from './demo.constants';

@Injectable()
export class DemoSeeder {
  private demoSeedPasswordHash: string | null = null;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {}

  private async getDemoSeedPasswordHash(): Promise<string> {
    if (this.demoSeedPasswordHash) return this.demoSeedPasswordHash;
    this.demoSeedPasswordHash = await argon2.hash(randomUUID(), {
      type: argon2.argon2id,
    });
    return this.demoSeedPasswordHash;
  }

  private stableHash(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  }

  private pickDemoSeedSubset(seedUsers: User[], seed: string): User[] {
    if (seedUsers.length === 0) return [];
    const desired = Math.min(
      seedUsers.length,
      Math.max(
        DEMO_SEED_FOLLOW_MIN,
        Math.floor(seedUsers.length * DEMO_SEED_FOLLOW_FRACTION),
      ),
    );
    const ranked = seedUsers
      .map((user) => ({ user, score: this.stableHash(`${seed}:${user.id}`) }))
      .sort((a, b) => a.score.localeCompare(b.score));
    return ranked.slice(0, desired).map((entry) => entry.user);
  }

  private buildDemoSeedPost(
    seed: Pick<User, 'id' | 'username' | 'fullName'>,
    index: number,
  ): Partial<Post> {
    const template =
      DEMO_SEED_POST_TEMPLATES[index % DEMO_SEED_POST_TEMPLATES.length];
    const prefix = index % 2 === 0 ? `${seed.fullName}: ` : '';
    const seedKey = `${seed.username}-${index}`;
    return {
      authorId: seed.id,
      content: `${prefix}${template}`,
      mediaUrl: `https://picsum.photos/seed/${seedKey}/600/600`,
    };
  }

  private buildDemoUserPost(
    demoUser: Pick<User, 'id' | 'username' | 'fullName'>,
    index: number,
  ): Partial<Post> {
    const template =
      DEMO_SEED_POST_TEMPLATES[index % DEMO_SEED_POST_TEMPLATES.length];
    const prefix = index % 2 === 0 ? `${demoUser.fullName}: ` : '';
    const seed = `${demoUser.username}-${index}`;
    return {
      authorId: demoUser.id,
      content: `${prefix}${template}`,
      mediaUrl: `https://picsum.photos/seed/${seed}/600/600`,
    };
  }

  async ensureDemoSeedUsers(): Promise<User[]> {
    const seedUsers: User[] = [];
    let seedHashedPassword: string | null = null;

    for (const profile of DEMO_SEED_USERS) {
      const existingSeed = await this.userRepository.findOne({
        where: { username: profile.username, isDemoSeed: true },
      });
      if (existingSeed) {
        const updates: Partial<User> = {};
        if (existingSeed.fullName !== profile.fullName) {
          updates.fullName = profile.fullName;
        }
        if ((existingSeed.bio ?? null) !== (profile.bio ?? null)) {
          updates.bio = profile.bio;
        }
        if (
          profile.profilePictureUrl &&
          existingSeed.profilePictureUrl !== profile.profilePictureUrl
        ) {
          updates.profilePictureUrl = profile.profilePictureUrl;
        }

        if (Object.keys(updates).length > 0) {
          await this.userRepository.update({ id: existingSeed.id }, updates);
          Object.assign(existingSeed, updates);
        }

        seedUsers.push(existingSeed);
        continue;
      }

      const existingAny = await this.userRepository.findOne({
        where: { username: profile.username },
      });
      if (existingAny) {
        if (existingAny.isDemoSeed) {
          const updates: Partial<User> = {};
          if (existingAny.fullName !== profile.fullName) {
            updates.fullName = profile.fullName;
          }
          if ((existingAny.bio ?? null) !== (profile.bio ?? null)) {
            updates.bio = profile.bio;
          }
          if (
            profile.profilePictureUrl &&
            existingAny.profilePictureUrl !== profile.profilePictureUrl
          ) {
            updates.profilePictureUrl = profile.profilePictureUrl;
          }

          if (Object.keys(updates).length > 0) {
            await this.userRepository.update({ id: existingAny.id }, updates);
            Object.assign(existingAny, updates);
          }

          seedUsers.push(existingAny);
          continue;
        }

        throw new ConflictException(
          `Demo seed username conflict: "${profile.username}" already exists`,
        );
      }

      if (!seedHashedPassword) {
        seedHashedPassword = await this.getDemoSeedPasswordHash();
      }

      const seedUser = this.userRepository.create({
        email: `${profile.username}@demo.isntgram.local`,
        username: profile.username,
        fullName: profile.fullName,
        bio: profile.bio,
        profilePictureUrl: profile.profilePictureUrl,
        hashedPassword: seedHashedPassword,
        postsCount: 0,
        followerCount: 0,
        followingCount: 0,
        isDemoUser: true,
        isDemoSeed: true,
        demoExpiresAt: null,
      });

      try {
        const saved = await this.userRepository.save(seedUser);
        seedUsers.push(saved);
      } catch (error) {
        // Handle concurrent demo session creation where another request wins the race
        // to create the demo seed user.
        if (isUniqueConstraintError(error)) {
          const concurrentSeed = await this.userRepository.findOne({
            where: { username: profile.username, isDemoSeed: true },
          });
          if (concurrentSeed) {
            seedUsers.push(concurrentSeed);
            continue;
          }
        }
        throw error;
      }
    }

    return seedUsers;
  }

  async ensureDemoSeedPosts(seedUsers: User[]): Promise<void> {
    if (seedUsers.length === 0) return;
    const postRepository = this.userRepository.manager.getRepository(Post);

    for (const seed of seedUsers) {
      const existingPosts = await postRepository.find({
        where: { authorId: seed.id },
        order: { createdAt: 'ASC', id: 'ASC' },
      });
      const existing = existingPosts.length;

      for (let index = 0; index < existingPosts.length; index++) {
        const post = existingPosts[index];
        const desired = this.buildDemoSeedPost(seed, index);
        if (post.mediaUrl !== desired.mediaUrl) {
          await postRepository.update(
            { id: post.id },
            { mediaUrl: desired.mediaUrl },
          );
        }
      }

      const missing = Math.max(0, DEMO_SEED_POSTS_PER_USER - existing);
      if (missing === 0) continue;

      const posts = Array.from({ length: missing }, (_, index) =>
        postRepository.create(this.buildDemoSeedPost(seed, existing + index)),
      );
      await postRepository.save(posts);
      await this.userRepository.increment(
        { id: seed.id },
        'postsCount',
        missing,
      );
    }
  }

  private pickTopNUsers(
    users: User[],
    seed: string,
    count: number,
    excludeIds: Set<string> = new Set(),
  ): User[] {
    const pool = users.filter((user) => !excludeIds.has(user.id));
    const ranked = pool
      .map((user) => ({ user, score: this.stableHash(`${seed}:${user.id}`) }))
      .sort((a, b) => a.score.localeCompare(b.score));
    return ranked.slice(0, count).map((entry) => entry.user);
  }

  async seedDemoSeedEngagement(seedUsers: User[]): Promise<void> {
    if (seedUsers.length === 0) return;

    const nodeEnv =
      this.configService.get<string>('NODE_ENV') ??
      process.env.NODE_ENV ??
      'development';
    if (nodeEnv === 'test') return;

    const postRepository = this.userRepository.manager.getRepository(Post);

    let likeRepository: Repository<Like> | null = null;
    let commentRepository: Repository<Comment> | null = null;
    let commentLikeRepository: Repository<CommentLike> | null = null;
    try {
      likeRepository = this.userRepository.manager.getRepository(Like);
      commentRepository = this.userRepository.manager.getRepository(Comment);
      commentLikeRepository =
        this.userRepository.manager.getRepository(CommentLike);
    } catch {
      return;
    }

    if (
      !likeRepository ||
      !commentRepository ||
      !commentLikeRepository ||
      typeof likeRepository.create !== 'function' ||
      typeof likeRepository.save !== 'function' ||
      typeof commentRepository.create !== 'function' ||
      typeof commentRepository.save !== 'function' ||
      typeof commentLikeRepository.create !== 'function' ||
      typeof commentLikeRepository.save !== 'function'
    ) {
      return;
    }

    const posts = await postRepository.find({
      where: { authorId: In(seedUsers.map((user) => user.id)) },
      order: { createdAt: 'DESC', id: 'DESC' },
    });

    const desiredLikes = 8;
    const desiredComments = 3;
    const desiredCommentLikes = 2;

    for (const post of posts) {
      const exclude = new Set([post.authorId]);

      const missingLikes = Math.max(0, desiredLikes - (post.likeCount ?? 0));
      if (missingLikes > 0) {
        const likeActors = this.pickTopNUsers(
          seedUsers,
          `seed-likes:${post.id}`,
          missingLikes,
          exclude,
        );
        for (const actor of likeActors) {
          try {
            await likeRepository.save(
              likeRepository.create({ postId: post.id, userId: actor.id }),
            );
            await postRepository.increment({ id: post.id }, 'likeCount', 1);
          } catch {
            // Ignore unique constraint races; this is best-effort seed data.
          }
        }
      }

      const missingComments = Math.max(
        0,
        desiredComments - (post.commentCount ?? 0),
      );
      if (missingComments > 0) {
        const commentActors = this.pickTopNUsers(
          seedUsers,
          `seed-comments:${post.id}`,
          missingComments,
          exclude,
        );

        for (let index = 0; index < commentActors.length; index++) {
          const actor = commentActors[index];
          const content =
            DEMO_NOTIFICATION_COMMENT_TEMPLATES[
              index % DEMO_NOTIFICATION_COMMENT_TEMPLATES.length
            ];
          const createdComment = await commentRepository.save(
            commentRepository.create({
              postId: post.id,
              authorId: actor.id,
              content,
            }),
          );
          await postRepository.increment({ id: post.id }, 'commentCount', 1);

          const commentExclude = new Set([actor.id]);
          const commentLikeActors = this.pickTopNUsers(
            seedUsers,
            `seed-comment-likes:${createdComment.id}`,
            desiredCommentLikes,
            commentExclude,
          );
          for (const liker of commentLikeActors) {
            try {
              await commentLikeRepository.save(
                commentLikeRepository.create({
                  commentId: createdComment.id,
                  userId: liker.id,
                }),
              );
              await commentRepository.increment(
                { id: createdComment.id },
                'likeCount',
                1,
              );
            } catch {
              // Ignore unique constraint races.
            }
          }
        }
      }
    }
  }

  async seedDemoSocialGraph(
    demoUserId: string,
    seedUsers: User[],
  ): Promise<User[]> {
    if (seedUsers.length === 0) return [];
    const followRepository = this.userRepository.manager.getRepository(Follow);

    const followTargets = this.pickDemoSeedSubset(
      seedUsers,
      `${demoUserId}:following`,
    );
    const followerUsers = this.pickDemoSeedSubset(
      seedUsers,
      `${demoUserId}:followers`,
    );

    const outgoingIds = followTargets.map((user) => user.id);
    const incomingIds = followerUsers.map((user) => user.id);

    const existingOutgoing = outgoingIds.length
      ? await followRepository.find({
          where: { followerId: demoUserId, followingId: In(outgoingIds) },
          select: ['followingId'],
        })
      : [];
    const existingOutgoingSet = new Set(
      existingOutgoing.map((follow) => follow.followingId),
    );
    const missingOutgoing = outgoingIds.filter(
      (id) => !existingOutgoingSet.has(id),
    );

    const existingIncoming = incomingIds.length
      ? await followRepository.find({
          where: { followingId: demoUserId, followerId: In(incomingIds) },
          select: ['followerId'],
        })
      : [];
    const existingIncomingSet = new Set(
      existingIncoming.map((follow) => follow.followerId),
    );
    const missingIncoming = incomingIds.filter(
      (id) => !existingIncomingSet.has(id),
    );

    if (missingOutgoing.length === 0 && missingIncoming.length === 0) {
      return followerUsers;
    }

    await this.userRepository.manager.transaction(async (manager) => {
      const followRepo = manager.getRepository(Follow);
      const userRepo = manager.getRepository(User);

      for (const followingId of missingOutgoing) {
        await followRepo.save(
          followRepo.create({ followerId: demoUserId, followingId }),
        );
        await userRepo.increment({ id: demoUserId }, 'followingCount', 1);
        await userRepo.increment({ id: followingId }, 'followerCount', 1);
      }

      for (const followerId of missingIncoming) {
        await followRepo.save(
          followRepo.create({ followerId, followingId: demoUserId }),
        );
        await userRepo.increment({ id: demoUserId }, 'followerCount', 1);
        await userRepo.increment({ id: followerId }, 'followingCount', 1);
      }
    });

    return followerUsers;
  }

  async seedDemoUserPosts(demoUser: User): Promise<Post[]> {
    const postRepository = this.userRepository.manager.getRepository(Post);

    const existingPosts = await postRepository.find({
      where: { authorId: demoUser.id },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    if (existingPosts.length >= DEMO_USER_INITIAL_POSTS) {
      return existingPosts.slice(0, DEMO_USER_INITIAL_POSTS);
    }

    const missing = DEMO_USER_INITIAL_POSTS - existingPosts.length;
    const created = Array.from({ length: missing }, (_, index) =>
      postRepository.create(
        this.buildDemoUserPost(demoUser, existingPosts.length + index),
      ),
    );
    const saved = await postRepository.save(created);
    const savedPosts = Array.isArray(saved) ? saved : [saved];
    await this.userRepository.increment(
      { id: demoUser.id },
      'postsCount',
      missing,
    );
    return [...savedPosts, ...existingPosts];
  }

  async seedDemoNotifications(params: {
    demoUserId: string;
    demoPosts: Post[];
    followerUsers: User[];
  }): Promise<void> {
    const { demoUserId, demoPosts, followerUsers } = params;

    if (demoPosts.length === 0) return;

    let notificationRepository: Repository<Notification> | null = null;
    try {
      notificationRepository =
        this.userRepository.manager.getRepository(Notification);
    } catch {
      return;
    }
    if (
      !notificationRepository ||
      typeof notificationRepository.create !== 'function' ||
      typeof notificationRepository.save !== 'function'
    ) {
      return;
    }

    const likeRepository = this.userRepository.manager.getRepository(Like);
    const commentRepository =
      this.userRepository.manager.getRepository(Comment);
    const postRepository = this.userRepository.manager.getRepository(Post);
    let commentLikeRepository: Repository<CommentLike> | null = null;
    try {
      commentLikeRepository =
        this.userRepository.manager.getRepository(CommentLike);
    } catch {
      commentLikeRepository = null;
    }

    const actors = followerUsers.slice(0, 6);
    if (actors.length === 0) return;

    try {
      const followNotifications = actors.slice(0, 3).map((actor) =>
        notificationRepository.create({
          recipientId: demoUserId,
          actorId: actor.id,
          type: 'follow',
        }),
      );
      await notificationRepository.save(followNotifications);

      const likeActors = actors.slice(0, 5);
      const likeTargets = demoPosts.slice(0, Math.min(3, demoPosts.length));

      for (let index = 0; index < likeActors.length; index++) {
        const actor = likeActors[index];
        const post = likeTargets[index % likeTargets.length];
        try {
          await likeRepository.save(
            likeRepository.create({ postId: post.id, userId: actor.id }),
          );
          await postRepository.increment({ id: post.id }, 'likeCount', 1);
        } catch {
          // Ignore unique constraint races — the notification seed is best-effort.
        }
        await notificationRepository.save(
          notificationRepository.create({
            recipientId: demoUserId,
            actorId: actor.id,
            type: 'like',
            postId: post.id,
          }),
        );
      }

      const commentActors = actors.slice(0, 3);
      for (let index = 0; index < commentActors.length; index++) {
        const actor = commentActors[index];
        const post = demoPosts[(index + 1) % demoPosts.length];
        const content =
          DEMO_NOTIFICATION_COMMENT_TEMPLATES[
            index % DEMO_NOTIFICATION_COMMENT_TEMPLATES.length
          ];
        const createdComment = await commentRepository.save(
          commentRepository.create({
            postId: post.id,
            authorId: actor.id,
            content,
          }),
        );
        await postRepository.increment({ id: post.id }, 'commentCount', 1);
        await notificationRepository.save(
          notificationRepository.create({
            recipientId: demoUserId,
            actorId: actor.id,
            type: 'comment',
            postId: post.id,
            commentId: createdComment.id,
          }),
        );

        const liker = actors[(index + 1) % actors.length];
        if (
          commentLikeRepository &&
          typeof commentLikeRepository.create === 'function' &&
          typeof commentLikeRepository.save === 'function'
        ) {
          try {
            await commentLikeRepository.save(
              commentLikeRepository.create({
                commentId: createdComment.id,
                userId: liker.id,
              }),
            );
            await commentRepository.increment(
              { id: createdComment.id },
              'likeCount',
              1,
            );
          } catch {
            // Best-effort.
          }
        }
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === 'EntityMetadataNotFoundError'
      ) {
        return;
      }
      throw error;
    }
  }
}
