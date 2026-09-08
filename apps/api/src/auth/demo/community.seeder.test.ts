import { DataSource } from 'typeorm';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Follow } from '../../follows/entities/follow.entity';
import { Comment } from '../../posts/entities/comment.entity';
import { Like } from '../../posts/entities/like.entity';
import { Post } from '../../posts/entities/post.entity';
import { User } from '../../users/entities/user.entity';
import { CommunitySeeder, communityId } from './community.seeder';
import { community } from './data/community';

describe('Saved fictional demo community', () => {
  let database: DataSource;
  beforeEach(async () => {
    database = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [User, Post, Comment, Like, Follow],
      synchronize: true,
    }).initialize();
  });
  afterEach(async () => {
    await database.destroy();
  });

  it('has 20 varied profiles, 150 unique verified photos, grounded copy and quiet lurkers', () => {
    expect(community.profiles).toHaveLength(20);
    expect(community.posts).toHaveLength(150);
    expect(new Set(community.posts.map((p) => p.mediaUrl)).size).toBe(150);
    expect(community.profiles.filter((p) => !p.postCount)).toHaveLength(4);
    for (const profile of community.profiles) {
      expect(
        community.posts.filter((p) => p.authorKey === profile.key),
      ).toHaveLength(profile.postCount);
    }
    const keys = new Set(community.profiles.map((p) => p.key));
    for (const post of community.posts) {
      expect(keys.has(post.authorKey)).toBe(true);
      expect(post.altText.length).toBeGreaterThan(10);
      expect(post.altText.length).toBeLessThanOrEqual(220);
      expect(post.caption.length).toBeLessThanOrEqual(500);
      expect(post.caption).not.toMatch(/lorem ipsum|AI assistant/i);
      for (const comment of post.comments) {
        expect(keys.has(comment.authorKey)).toBe(true);
        expect(['theo_mercer', 'clare_nwosu', 'ruben_silva']).not.toContain(
          comment.authorKey,
        );
      }
      for (const key of post.likedBy) expect(keys.has(key)).toBe(true);
      const bytes = readFileSync(
        resolve(__dirname, '../../../../web/public', post.mediaUrl.slice(1)),
      );
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(
        post.photoSha256,
      );
    }
  });

  it('seeds accurate counts and repeats without duplicating or replacing visitor content', async () => {
    const users = database.getRepository(User);
    const posts = database.getRepository(Post);
    const seeder = new CommunitySeeder(users);
    await seeder.ensureCommunity();
    expect(await users.count()).toBe(20);
    expect(await posts.count()).toBe(150);
    const first = community.posts[0];
    await posts.update(communityId(first.key), {
      content: 'An intentional local edit',
    });
    const visitor = await users.save(
      users.create({
        username: 'visitor',
        fullName: 'Visitor',
        email: 'visitor@example.invalid',
        hashedPassword: 'unusable',
        isDemoUser: true,
      }),
    );
    await posts.save(
      posts.create({
        authorId: visitor.id,
        content: 'Visitor content',
        mediaUrl: '/own-photo.jpg',
      }),
    );
    const commentsBefore = await database.getRepository(Comment).count();
    const likesBefore = await database.getRepository(Like).count();
    const followsBefore = await database.getRepository(Follow).count();
    await seeder.ensureCommunity();
    expect(await users.count()).toBe(21);
    expect(await posts.count()).toBe(151);
    expect(
      (await posts.findOneByOrFail({ id: communityId(first.key) })).content,
    ).toBe('An intentional local edit');
    expect(await database.getRepository(Comment).count()).toBe(commentsBefore);
    expect(await database.getRepository(Like).count()).toBe(likesBefore);
    expect(await database.getRepository(Follow).count()).toBe(followsBefore);
    for (const user of await users.findBy({ isDemoSeed: true })) {
      expect(user.postsCount).toBe(await posts.countBy({ authorId: user.id }));
      expect(user.followingCount).toBe(
        await database.getRepository(Follow).countBy({ followerId: user.id }),
      );
      expect(user.followerCount).toBe(
        await database.getRepository(Follow).countBy({ followingId: user.id }),
      );
    }
    for (const post of await posts.find()) {
      expect(post.likeCount).toBe(
        await database.getRepository(Like).countBy({ postId: post.id }),
      );
      expect(post.commentCount).toBe(
        await database.getRepository(Comment).countBy({ postId: post.id }),
      );
    }
  });

  it('rolls back on a real username conflict without changing that account', async () => {
    const users = database.getRepository(User);
    const profile = community.profiles[5];
    await users.save(
      users.create({
        username: profile.username,
        fullName: 'Real person',
        email: 'real@example.invalid',
        hashedPassword: 'unusable',
      }),
    );
    await expect(new CommunitySeeder(users).ensureCommunity()).rejects.toThrow(
      'Demo profile conflict',
    );
    expect(await users.count()).toBe(1);
    expect(await database.getRepository(Post).count()).toBe(0);
    expect(
      (await users.findOneByOrFail({ username: profile.username })).fullName,
    ).toBe('Real person');
  });
});
