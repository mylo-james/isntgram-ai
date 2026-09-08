import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import argon2 from 'argon2';
import { createHash, randomUUID } from 'crypto';
import { Repository } from 'typeorm';
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
    const password = await argon2.hash(randomUUID(), { type: argon2.argon2id });
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
      const epoch = Date.now() - 60 * 60 * 1000;
      const result: User[] = [];
      for (const profile of community.profiles) {
        const id = communityId(`user:${profile.key}`);
        const existing = await users.findOne({
          where: [{ id }, { username: profile.username }],
        });
        if (existing && (existing.id !== id || !existing.isDemoSeed)) {
          throw new ConflictException(
            `Demo profile conflict: ${profile.username}`,
          );
        }
        if (existing) {
          result.push(existing);
          continue;
        }
        result.push(
          await users.save(
            users.create({
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
            }),
          ),
        );
      }
      for (const entry of community.posts) {
        const id = communityId(entry.key);
        const authorId = communityId(`user:${entry.authorKey}`);
        const existing = await posts.findOneBy({ id });
        if (existing && existing.authorId !== authorId)
          throw new ConflictException('Demo post identity conflict');
        const createdAt =
          existing?.createdAt ?? new Date(epoch - entry.ageHours * 3600000);
        if (!existing)
          await posts.save(
            posts.create({
              id,
              authorId,
              content: entry.caption,
              mediaUrl: entry.mediaUrl,
              mediaAltText: entry.altText,
              createdAt,
              updatedAt: createdAt,
            }),
          );
        for (const [index, comment] of entry.comments.entries()) {
          const commentId = communityId(`${entry.key}:comment:${index}`);
          if (await comments.existsBy({ id: commentId })) continue;
          const time = new Date(createdAt.getTime() + (index + 1) * 5 * 60000);
          await comments.save(
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
          if (await likes.existsBy({ postId: id, userId })) continue;
          await likes.save(
            likes.create({
              postId: id,
              userId,
              createdAt: new Date(createdAt.getTime() + 60000),
            }),
          );
        }
        await posts.update(id, {
          likeCount: await likes.countBy({ postId: id }),
          commentCount: await comments.countBy({ postId: id }),
        });
      }
      for (const edge of community.follows) {
        const followerId = communityId(`user:${edge.from}`);
        const followingId = communityId(`user:${edge.to}`);
        if (await follows.existsBy({ followerId, followingId })) continue;
        await follows.save(follows.create({ followerId, followingId }));
      }
      for (const user of result) {
        const counts = {
          postsCount: await posts.countBy({ authorId: user.id }),
          followerCount: await follows.countBy({ followingId: user.id }),
          followingCount: await follows.countBy({ followerId: user.id }),
        };
        await users.update(user.id, counts);
        Object.assign(user, counts);
      }
      return result;
    });
  }
}
