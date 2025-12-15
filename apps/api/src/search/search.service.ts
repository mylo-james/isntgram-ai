import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Post } from '../posts/entities/post.entity';
import { PostLike } from '../likes/entities/post-like.entity';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchResponseDto } from './dto/search-response.dto';
import { UserSummaryDto } from '../common/dto/user-summary.dto';
import { FeedPostDto } from '../posts/dto/feed-post.dto';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(PostLike)
    private readonly postLikesRepository: Repository<PostLike>,
  ) {}

  async search(
    dto: SearchQueryDto,
    viewerUserId?: string,
  ): Promise<SearchResponseDto> {
    const query = dto.q.trim();
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 10;

    if (!query) {
      return {
        query,
        users: [],
        posts: [],
        usersPagination: { page, limit, total: 0, hasMore: false },
        postsPagination: { page, limit, total: 0, hasMore: false },
      };
    }

    const type = dto.type ?? 'all';
    const [usersRes, postsRes] = await Promise.all([
      type === 'all' || type === 'users'
        ? this.searchUsers(query, page, limit)
        : Promise.resolve({
            users: [],
            pagination: { page, limit, total: 0, hasMore: false },
          }),
      type === 'all' || type === 'posts'
        ? this.searchPosts(query, page, limit, viewerUserId)
        : Promise.resolve({
            posts: [],
            pagination: { page, limit, total: 0, hasMore: false },
          }),
    ]);

    return {
      query,
      users: usersRes.users,
      posts: postsRes.posts,
      usersPagination: usersRes.pagination,
      postsPagination: postsRes.pagination,
    };
  }

  private async searchUsers(query: string, page: number, limit: number) {
    const offset = (page - 1) * limit;
    const q = `%${query.toLowerCase()}%`;

    const [users, total] = await this.userRepository
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.username',
        'user.fullName',
        'user.profilePictureUrl',
      ])
      .where('LOWER(user.username) LIKE :q', { q })
      .orWhere('LOWER(user.fullName) LIKE :q', { q })
      .orderBy('user.username', 'ASC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return {
      users: users.map(
        (u): UserSummaryDto => ({
          id: u.id,
          username: u.username,
          fullName: u.fullName,
          profilePictureUrl: u.profilePictureUrl ?? undefined,
        }),
      ),
      pagination: {
        page,
        limit,
        total,
        hasMore: offset + users.length < total,
      },
    };
  }

  private async searchPosts(
    query: string,
    page: number,
    limit: number,
    viewerUserId?: string,
  ) {
    const offset = (page - 1) * limit;
    const normalized = query.startsWith('#') ? query.slice(1) : query;

    // Primary: hashtag search when query starts with '#'
    // Fallback: substring search in post content.
    const contentPattern = query.startsWith('#')
      ? `%#${normalized.toLowerCase()}%`
      : `%${normalized.toLowerCase()}%`;

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
      .where('LOWER(post.content) LIKE :q', { q: contentPattern })
      .orderBy('post.createdAt', 'DESC')
      .skip(offset)
      .take(limit);

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

    return {
      posts: posts.map(
        (p): FeedPostDto => ({
          id: p.id,
          content: p.content,
          likesCount: p.likesCount,
          commentsCount: p.commentsCount,
          likedByMe: viewerUserId ? likedPostIds.has(p.id) : false,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
          author: {
            id: p.user.id,
            username: p.user.username,
            fullName: p.user.fullName,
            profilePictureUrl: p.user.profilePictureUrl ?? undefined,
          },
        }),
      ),
      pagination: {
        page,
        limit,
        total,
        hasMore: offset + posts.length < total,
      },
    };
  }
}
