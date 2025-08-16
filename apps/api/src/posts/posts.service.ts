import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { User } from '../users/entities/user.entity';
import { CreatePostDto, PostResponseDto } from './dto/post.dto';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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
    });

    const savedPost = await this.postRepository.save(post);

    // Update user posts count
    await this.userRepository.increment({ id: userId }, 'postsCount', 1);

    // Get user info for response
    const postWithUser = await this.postRepository.findOne({
      where: { id: savedPost.id },
      relations: ['user'],
    });

    return {
      id: postWithUser!.id,
      userId: postWithUser!.userId,
      caption: postWithUser!.caption,
      imageUrl: postWithUser!.imageUrl,
      likesCount: postWithUser!.likesCount,
      commentsCount: postWithUser!.commentsCount,
      createdAt: postWithUser!.createdAt,
      updatedAt: postWithUser!.updatedAt,
      user: {
        id: postWithUser!.user.id,
        username: postWithUser!.user.username,
        fullName: postWithUser!.user.fullName,
        profilePictureUrl: postWithUser!.user.profilePictureUrl,
      },
    };
  }

  async deletePost(
    userId: string,
    postId: string,
  ): Promise<{ message: string }> {
    const post = await this.postRepository.findOne({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.userId !== userId) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    // Update user posts count
    await this.userRepository.decrement({ id: userId }, 'postsCount', 1);

    // Remove post
    await this.postRepository.remove(post);

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
    const posts = await this.postRepository.find({
      where: { user: { username } },
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
    // For now, return all posts ordered by creation date
    // Later this can be enhanced to show only posts from followed users
    const posts = await this.postRepository.find({
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
}