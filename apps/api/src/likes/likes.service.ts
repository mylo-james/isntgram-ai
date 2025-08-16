import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Like } from './entities/like.entity';
import { Post } from '../posts/entities/post.entity';
import { LikeDto, LikeResponseDto, LikeStatsDto } from './dto/like.dto';

@Injectable()
export class LikesService {
  constructor(
    @InjectRepository(Like)
    private readonly likeRepository: Repository<Like>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
  ) {}

  async likePost(userId: string, likeDto: LikeDto): Promise<LikeResponseDto> {
    const { postId } = likeDto;

    // Check if post exists
    const post = await this.postRepository.findOne({
      where: { id: postId },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Check if already liked
    const existingLike = await this.likeRepository.findOne({
      where: { userId, postId },
    });
    if (existingLike) {
      throw new ConflictException('You have already liked this post');
    }

    // Create like
    const like = this.likeRepository.create({
      userId,
      postId,
    });

    const savedLike = await this.likeRepository.save(like);

    // Update post likes count
    await this.postRepository.increment({ id: postId }, 'likesCount', 1);

    return {
      id: savedLike.id,
      userId: savedLike.userId,
      postId: savedLike.postId,
      createdAt: savedLike.createdAt,
    };
  }

  async unlikePost(userId: string, likeDto: LikeDto): Promise<{ message: string }> {
    const { postId } = likeDto;

    // Check if like exists
    const like = await this.likeRepository.findOne({
      where: { userId, postId },
    });
    if (!like) {
      throw new NotFoundException('You have not liked this post');
    }

    // Remove like
    await this.likeRepository.remove(like);

    // Update post likes count
    await this.postRepository.decrement({ id: postId }, 'likesCount', 1);

    return { message: 'Post unliked successfully' };
  }

  async getLikeStats(userId: string, postId: string): Promise<LikeStatsDto> {
    // Get likes count for the post
    const likesCount = await this.likeRepository.count({
      where: { postId },
    });

    // Check if current user liked the post
    let isLiked = false;
    if (userId) {
      const userLike = await this.likeRepository.findOne({
        where: { userId, postId },
      });
      isLiked = !!userLike;
    }

    return {
      likesCount,
      isLiked,
    };
  }

  async getPostLikes(postId: string, page = 1, limit = 20): Promise<any[]> {
    const likes = await this.likeRepository.find({
      where: { postId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return likes.map(like => ({
      id: like.id,
      createdAt: like.createdAt,
      user: {
        id: like.user.id,
        username: like.user.username,
        fullName: like.user.fullName,
        profilePictureUrl: like.user.profilePictureUrl,
      },
    }));
  }
}