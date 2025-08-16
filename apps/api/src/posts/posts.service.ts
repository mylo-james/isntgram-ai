import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { User } from '../users/entities/user.entity';
import { Follow } from '../follows/entities/follows.entity';
import { CreatePostDto, PostResponseDto } from './dto/create-post.dto';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
  ) {}

  async createPost(
    userId: string,
    createPostDto: CreatePostDto,
  ): Promise<PostResponseDto> {
    const { caption, imageUrl } = createPostDto;

    // Create post
    const post = this.postRepository.create({
      userId,
      caption,
      imageUrl,
      likesCount: 0,
      commentsCount: 0,
    });

    const savedPost = await this.postRepository.save(post);

    // Update user's post count
    await this.userRepository.increment({ id: userId }, 'postsCount', 1);

    // Get user info for response
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'username', 'fullName', 'profilePictureUrl'],
    });

    return {
      id: savedPost.id,
      userId: savedPost.userId,
      caption: savedPost.caption,
      imageUrl: savedPost.imageUrl,
      likesCount: savedPost.likesCount,
      commentsCount: savedPost.commentsCount,
      createdAt: savedPost.createdAt,
      updatedAt: savedPost.updatedAt,
      user: user ? {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        profilePictureUrl: user.profilePictureUrl,
      } : undefined,
    };
  }

  async deletePost(userId: string, postId: string): Promise<{ message: string }> {
    const post = await this.postRepository.findOne({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.userId !== userId) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    await this.postRepository.remove(post);

    // Update user's post count
    await this.userRepository.decrement({ id: userId }, 'postsCount', 1);

    return { message: 'Post deleted successfully' };
  }

  async getPost(postId: string): Promise<PostResponseDto> {
    const post = await this.postRepository.findOne({
      where: { id: postId },
      relations: ['user'],
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return {
      id: post.id,
      userId: post.userId,
      caption: post.caption,
      imageUrl: post.imageUrl,
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      user: {
        id: post.user.id,
        username: post.user.username,
        fullName: post.user.fullName,
        profilePictureUrl: post.user.profilePictureUrl,
      },
    };
  }

  async getUserPosts(
    username: string,
    page = 1,
    limit = 12,
  ): Promise<PostResponseDto[]> {
    const user = await this.userRepository.findOne({
      where: { username },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const posts = await this.postRepository.find({
      where: { userId: user.id },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return posts.map(post => ({
      id: post.id,
      userId: post.userId,
      caption: post.caption,
      imageUrl: post.imageUrl,
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      user: {
        id: post.user.id,
        username: post.user.username,
        fullName: post.user.fullName,
        profilePictureUrl: post.user.profilePictureUrl,
      },
    }));
  }

  async getFeed(
    userId: string,
    page = 1,
    limit = 10,
  ): Promise<PostResponseDto[]> {
    // Get users that the current user follows
    const following = await this.followRepository.find({
      where: { followerId: userId },
      select: ['followingId'],
    });

    const followingIds = following.map(f => f.followingId);
    
    // Include the user's own posts in the feed
    followingIds.push(userId);

    if (followingIds.length === 0) {
      return [];
    }

    const posts = await this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.user', 'user')
      .where('post.userId IN (:...userIds)', { userIds: followingIds })
      .orderBy('post.createdAt', 'DESC')
      .take(limit)
      .skip((page - 1) * limit)
      .getMany();

    return posts.map(post => ({
      id: post.id,
      userId: post.userId,
      caption: post.caption,
      imageUrl: post.imageUrl,
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      user: {
        id: post.user.id,
        username: post.user.username,
        fullName: post.user.fullName,
        profilePictureUrl: post.user.profilePictureUrl,
      },
    }));
  }
}