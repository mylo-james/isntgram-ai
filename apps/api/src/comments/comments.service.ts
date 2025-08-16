import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { Post } from '../posts/entities/post.entity';
import { CreateCommentDto, UpdateCommentDto, CommentResponseDto } from './dto/comment.dto';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
  ) {}

  async createComment(
    userId: string,
    createCommentDto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    const { postId, content } = createCommentDto;

    // Check if post exists
    const post = await this.postRepository.findOne({
      where: { id: postId },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Create comment
    const comment = this.commentRepository.create({
      userId,
      postId,
      content,
    });

    const savedComment = await this.commentRepository.save(comment);

    // Update post comments count
    await this.postRepository.increment({ id: postId }, 'commentsCount', 1);

    // Get user info for response
    const commentWithUser = await this.commentRepository.findOne({
      where: { id: savedComment.id },
      relations: ['user'],
    });

    return {
      id: commentWithUser!.id,
      userId: commentWithUser!.userId,
      postId: commentWithUser!.postId,
      content: commentWithUser!.content,
      createdAt: commentWithUser!.createdAt,
      updatedAt: commentWithUser!.updatedAt,
      user: {
        id: commentWithUser!.user.id,
        username: commentWithUser!.user.username,
        fullName: commentWithUser!.user.fullName,
        profilePictureUrl: commentWithUser!.user.profilePictureUrl,
      },
    };
  }

  async updateComment(
    userId: string,
    commentId: string,
    updateCommentDto: UpdateCommentDto,
  ): Promise<CommentResponseDto> {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
      relations: ['user'],
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    comment.content = updateCommentDto.content;
    const updatedComment = await this.commentRepository.save(comment);

    return {
      id: updatedComment.id,
      userId: updatedComment.userId,
      postId: updatedComment.postId,
      content: updatedComment.content,
      createdAt: updatedComment.createdAt,
      updatedAt: updatedComment.updatedAt,
      user: {
        id: updatedComment.user.id,
        username: updatedComment.user.username,
        fullName: updatedComment.user.fullName,
        profilePictureUrl: updatedComment.user.profilePictureUrl,
      },
    };
  }

  async deleteComment(
    userId: string,
    commentId: string,
  ): Promise<{ message: string }> {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    // Update post comments count
    await this.postRepository.decrement({ id: comment.postId }, 'commentsCount', 1);

    // Remove comment
    await this.commentRepository.remove(comment);

    return { message: 'Comment deleted successfully' };
  }

  async getPostComments(
    postId: string,
    page = 1,
    limit = 20,
  ): Promise<CommentResponseDto[]> {
    const comments = await this.commentRepository.find({
      where: { postId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return comments.map(comment => ({
      id: comment.id,
      userId: comment.userId,
      postId: comment.postId,
      content: comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      user: {
        id: comment.user.id,
        username: comment.user.username,
        fullName: comment.user.fullName,
        profilePictureUrl: comment.user.profilePictureUrl,
      },
    }));
  }

  async getComment(commentId: string): Promise<CommentResponseDto> {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
      relations: ['user'],
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    return {
      id: comment.id,
      userId: comment.userId,
      postId: comment.postId,
      content: comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      user: {
        id: comment.user.id,
        username: comment.user.username,
        fullName: comment.user.fullName,
        profilePictureUrl: comment.user.profilePictureUrl,
      },
    };
  }
}