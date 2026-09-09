import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import argon2 from 'argon2';
import { createHash, randomUUID } from 'crypto';
import { In, Repository } from 'typeorm';
import { Follow } from '../../follows/entities/follow.entity';
import { Comment } from '../../posts/entities/comment.entity';
import { Like } from '../../posts/entities/like.entity';
import { Post } from '../../posts/entities/post.entity';
import { User } from '../../users/entities/user.entity';
import { community } from './data/community';

export function communityId(key: string): string {
  const hash = createHash('sha256')
    .update(`isntgram-community-v1:${key}`)
    .digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

/** Saved fictional content. No model or remote image calls occur during seeding. */
@Injectable()
export class CommunitySeeder {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async ensureCommunity(): Promise<User[]> {
    return this.users.manager.transaction(async (manager) => {
      if (manager.connection.options.type === 'postgres') {
        await manager.query(
          "SELECT pg_advisory_xact_lock(hashtext('isntgram-community-v1'))",
        );
      }
      const users = manager.getRepository(User);
      const posts = manager.getRepository(Post);
      const comments = manager.getRepository(Comment);
      const likes = manager.getRepository(Like);
      const follows = manager.getRepository(Follow);
      const userIds = community.profiles.map((profile) =>
        communityId(`user:${profile.key}`),
      );
      const existingUsers = await users.find({
        where: [
          { id: In(userIds) },
          {
            username: In(community.profiles.map((profile) => profile.username)),
          },
        ],
      });
      const usersById = new Map(existingUsers.map((user) => [user.id, user]));
      const usersByName = new Map(
        existingUsers.map((user) => [user.username, user]),
      );
      const result: User[] = [];
      const newUsers: User[] = [];
      let password: string | undefined;
      for (const profile of community.profiles) {
        const id = communityId(`user:${profile.key}`);
        const existing = usersById.get(id);
        const named = usersByName.get(profile.username);
        if ((existing && !existing.isDemoSeed) || (named && named.id !== id)) {
          throw new ConflictException(
            `Demo profile conflict: ${profile.username}`,
          );
        }
        if (existing) {
          result.push(existing);
          continue;
        }
        password ??= await argon2.hash(randomUUID(), { type: argon2.argon2id });
        const user = users.create({
          id,
          username: profile.username,
          fullName: profile.fullName,
          bio: profile.bio,
          email: `${profile.key}@community.isntgram.local`,
          profilePictureUrl: `/demo-community/avatars/${profile.key}.png`,
          hashedPassword: password,
          isDemoUser: true,
          isDemoSeed: true,
          demoExpiresAt: null,
          postsCount: 0,
          followerCount: 0,
          followingCount: 0,
        });
        newUsers.push(user);
        result.push(user);
      }
      await insertBatches(newUsers, (batch) => users.insert(batch));

      const postIds = community.posts.map((entry) => communityId(entry.key));
      const allPosts = await posts.find({
        where: [{ id: In(postIds) }, { authorId: In(userIds) }],
      });
      const postsById = new Map(allPosts.map((post) => [post.id, post]));
      const newPosts: Post[] = [];
      const epoch = Date.now() - 60 * 60 * 1000;
      for (const entry of community.posts) {
        const id = communityId(entry.key);
        const authorId = communityId(`user:${entry.authorKey}`);
        const existing = postsById.get(id);
        if (existing && existing.authorId !== authorId)
          throw new ConflictException('Demo post identity conflict');
        if (existing) continue;
        const createdAt = new Date(epoch - entry.ageHours * 3600000);
        const post = posts.create({
          id,
          authorId,
          content: entry.caption,
          mediaUrl: entry.mediaUrl,
          mediaAltText: entry.altText,
          createdAt,
          updatedAt: createdAt,
          likeCount: 0,
          commentCount: 0,
        });
        newPosts.push(post);
        allPosts.push(post);
        postsById.set(id, post);
      }
      await insertBatches(newPosts, (batch) => posts.insert(batch));

      // Read each relationship collection once, including visitor engagement.
      // Repeat sign-ins need only these bulk reads, with no per-row lookups.
      const allComments = await comments.find({
        where: { postId: In(postIds) },
        select: ['id', 'postId'],
      });
      const commentIds = new Set(allComments.map((comment) => comment.id));
      const allLikes = await likes.find({
        where: { postId: In(postIds) },
        select: ['postId', 'userId'],
      });
      const likeKeys = new Set(
        allLikes.map((like) => `${like.postId}:${like.userId}`),
      );
      const newComments: Comment[] = [];
      const newLikes: Like[] = [];
      for (const entry of community.posts) {
        const id = communityId(entry.key);
        const createdAt = postsById.get(id)!.createdAt;
        for (const [index, comment] of entry.comments.entries()) {
          const commentId = communityId(`${entry.key}:comment:${index}`);
          if (commentIds.has(commentId)) continue;
          const time = new Date(createdAt.getTime() + (index + 1) * 5 * 60000);
          newComments.push(
            comments.create({
              id: commentId,
              postId: id,
              authorId: communityId(`user:${comment.authorKey}`),
              content: comment.content,
              createdAt: time,
              updatedAt: time,
            }),
          );
        }
        for (const key of entry.likedBy) {
          const userId = communityId(`user:${key}`);
          if (likeKeys.has(`${id}:${userId}`)) continue;
          newLikes.push(
            likes.create({
              postId: id,
              userId,
              createdAt: new Date(createdAt.getTime() + 60000),
            }),
          );
        }
      }
      await insertBatches(newComments, (batch) => comments.insert(batch));
      await insertBatches(newLikes, (batch) => likes.insert(batch));
      const commentCounts = tally(
        [...allComments, ...newComments],
        (comment) => comment.postId,
      );
      const likeCounts = tally(
        [...allLikes, ...newLikes],
        (like) => like.postId,
      );
      for (const id of postIds) {
        const post = postsById.get(id)!;
        const counts = {
          likeCount: likeCounts.get(id) ?? 0,
          commentCount: commentCounts.get(id) ?? 0,
        };
        if (
          post.likeCount !== counts.likeCount ||
          post.commentCount !== counts.commentCount
        ) {
          await posts.update(id, counts);
        }
      }
      const allFollows = await follows.find({
        where: [{ followerId: In(userIds) }, { followingId: In(userIds) }],
        select: ['followerId', 'followingId'],
      });
      const followKeys = new Set(
        allFollows.map(
          (follow) => `${follow.followerId}:${follow.followingId}`,
        ),
      );
      const newFollows: Follow[] = [];
      for (const edge of community.follows) {
        const followerId = communityId(`user:${edge.from}`);
        const followingId = communityId(`user:${edge.to}`);
        if (followKeys.has(`${followerId}:${followingId}`)) continue;
        newFollows.push(follows.create({ followerId, followingId }));
      }
      await insertBatches(newFollows, (batch) => follows.insert(batch));
      const followingCounts = tally(
        [...allFollows, ...newFollows],
        (follow) => follow.followerId,
      );
      const followerCounts = tally(
        [...allFollows, ...newFollows],
        (follow) => follow.followingId,
      );
      const postCounts = tally(allPosts, (post) => post.authorId);
      for (const user of result) {
        const counts = {
          postsCount: postCounts.get(user.id) ?? 0,
          followerCount: followerCounts.get(user.id) ?? 0,
          followingCount: followingCounts.get(user.id) ?? 0,
        };
        if (
          user.postsCount !== counts.postsCount ||
          user.followerCount !== counts.followerCount ||
          user.followingCount !== counts.followingCount
        ) {
          await users.update(user.id, counts);
          Object.assign(user, counts);
        }
      }
      return result;
    });
  }
}

// Stay within conservative SQL parameter limits on both SQLite and PostgreSQL.
async function insertBatches<T>(
  rows: T[],
  insert: (batch: T[]) => Promise<unknown>,
): Promise<void> {
  for (let start = 0; start < rows.length; start += 50)
    await insert(rows.slice(start, start + 50));
}
function tally<T>(rows: T[], key: (row: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const id = key(row);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}
