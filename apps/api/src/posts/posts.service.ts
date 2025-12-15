import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { FeedQueryDto } from './dto/feed-query.dto';
import { User } from '../users/entities/user.entity';
import { PostLike } from '../likes/entities/post-like.entity';

export type FeedPost = {
  id: string;
  content: string;
  likesCount: number;
  commentsCount: number;
  likedByMe: boolean;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    username: string;
    fullName: string;
    profilePictureUrl?: string;
  };
};

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(PostLike)
    private readonly postLikesRepository: Repository<PostLike>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async createPost(userId: string, dto: CreatePostDto): Promise<FeedPost> {
    const savedId = await this.dataSource.transaction(async (manager) => {
      const postsRepo = manager.getRepository(Post);
      const usersRepo = manager.getRepository(User);

      const post = postsRepo.create({
        userId,
        content: dto.content,
      });

      const saved = await postsRepo.save(post);
      await usersRepo.increment({ id: userId }, 'postsCount', 1);
      return saved.id;
    });

    return this.getPostById(savedId, userId);
  }

  async getFeed(viewerUserId: string, query: FeedQueryDto) {
    return this.listPosts({ viewerUserId, query });
  }

  async getExplore(viewerUserId: string | undefined, query: FeedQueryDto) {
    // For now explore is the global, most-recent posts list (no personalization).
    // Keep it separate from /feed to allow future evolution without breaking clients.
    return this.listPosts({ viewerUserId, query });
  }

  async getPostById(postId: string, viewerUserId?: string): Promise<FeedPost> {
    const post = await this.postRepository
      .createQueryBuilder('post')
      .innerJoin('post.user', 'user')
      .select([
        'post.id',
        'post.content',
        'post.likesCount',
        'post.commentsCount',
        'post.createdAt',
        'post.updatedAt',
        'post.userId',
        'user.id',
        'user.username',
        'user.fullName',
        'user.profilePictureUrl',
      ])
      .where('post.id = :postId', { postId })
      .getOne();

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const likedByMe = viewerUserId
      ? Boolean(
          await this.postLikesRepository.findOne({
            where: { userId: viewerUserId, postId: post.id },
            select: ['id'],
          }),
        )
      : false;

    return {
      id: post.id,
      content: post.content,
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      likedByMe,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      author: {
        id: post.user.id,
        username: post.user.username,
        fullName: post.user.fullName,
        profilePictureUrl: post.user.profilePictureUrl ?? undefined,
      },
    };
  }

  async getPostsByUsername(
    username: string,
    query: FeedQueryDto,
    viewerUserId?: string,
  ) {
    return this.listPosts({ username, viewerUserId, query });
  }

  async deletePost(userId: string, postId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const postsRepo = manager.getRepository(Post);
      const usersRepo = manager.getRepository(User);

      const post = await postsRepo.findOne({ where: { id: postId } });
      if (!post) {
        throw new NotFoundException('Post not found');
      }

      if (post.userId !== userId) {
        throw new ForbiddenException('You can only delete your own posts');
      }

      await postsRepo.delete({ id: postId });
      await usersRepo.decrement({ id: userId }, 'postsCount', 1);
    });
  }

  private async listPosts({
    query,
    viewerUserId,
    username,
  }: {
    query: FeedQueryDto;
    viewerUserId?: string;
    username?: string;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const qb = this.postRepository
      .createQueryBuilder('post')
      .innerJoin('post.user', 'user')
      .select([
        'post.id',
        'post.content',
        'post.likesCount',
        'post.commentsCount',
        'post.createdAt',
        'post.updatedAt',
        'user.id',
        'user.username',
        'user.fullName',
        'user.profilePictureUrl',
      ])
      .orderBy('post.createdAt', 'DESC')
      .skip(offset)
      .take(limit);

    if (username) {
      qb.where('user.username = :username', { username });
    }

    const [posts, total] = await qb.getManyAndCount();

    const likedPostIds =
      viewerUserId && posts.length > 0
        ? new Set(
            (
              await this.postLikesRepository.find({
                where: {
                  userId: viewerUserId,
                  postId: In(posts.map((p) => p.id)),
                },
                select: ['postId'],
              })
            ).map((l) => l.postId),
          )
        : new Set<string>();

    const viewPosts: FeedPost[] = posts.map((post) => ({
      id: post.id,
      content: post.content,
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      likedByMe: viewerUserId ? likedPostIds.has(post.id) : false,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      author: {
        id: post.user.id,
        username: post.user.username,
        fullName: post.user.fullName,
        profilePictureUrl: post.user.profilePictureUrl ?? undefined,
      },
    }));

    return {
      posts: viewPosts,
      pagination: {
        page,
        limit,
        total,
        hasMore: offset + viewPosts.length < total,
      },
    };
  }
}
