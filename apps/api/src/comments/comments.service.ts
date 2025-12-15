import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { Post as PostEntity } from '../posts/entities/post.entity';
import { User } from '../users/entities/user.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentViewDto } from './dto/comment-view.dto';
import { CommentsResponseDto } from './dto/comments-response.dto';
import { MessageResponseDto } from '../common/dto/message-response.dto';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentsRepository: Repository<Comment>,
    @InjectRepository(PostEntity)
    private readonly postsRepository: Repository<PostEntity>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async getComments(
    postId: string,
    page = 1,
    limit = 20,
  ): Promise<CommentsResponseDto> {
    const post = await this.postsRepository.findOne({
      where: { id: postId },
      select: ['id'],
    });
    if (!post) throw new NotFoundException('Post not found');

    const offset = (page - 1) * limit;
    const [comments, total] = await this.commentsRepository
      .createQueryBuilder('comment')
      .innerJoin('comment.user', 'user')
      .select([
        'comment.id',
        'comment.text',
        'comment.createdAt',
        'comment.updatedAt',
        'comment.userId',
        'user.id',
        'user.username',
        'user.fullName',
        'user.profilePictureUrl',
      ])
      .where('comment.postId = :postId', { postId })
      .orderBy('comment.createdAt', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    const views: CommentViewDto[] = comments.map((c) => ({
      id: c.id,
      text: c.text,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      author: {
        id: c.user.id,
        username: c.user.username,
        fullName: c.user.fullName,
        profilePictureUrl: c.user.profilePictureUrl ?? undefined,
      },
    }));

    return {
      comments: views,
      pagination: {
        page,
        limit,
        total,
        hasMore: offset + views.length < total,
      },
    };
  }

  async createComment(
    userId: string,
    postId: string,
    dto: CreateCommentDto,
  ): Promise<CommentViewDto> {
    return this.dataSource.transaction(async (manager) => {
      const commentsRepo = manager.getRepository(Comment);
      const postsRepo = manager.getRepository(PostEntity);

      const post = await postsRepo.findOne({ where: { id: postId } });
      if (!post) throw new NotFoundException('Post not found');

      const user = await this.usersRepository.findOne({
        where: { id: userId },
        select: ['id', 'username', 'fullName', 'profilePictureUrl'],
      });
      if (!user) throw new NotFoundException('User not found');

      const comment = commentsRepo.create({
        userId,
        postId,
        text: dto.text.trim(),
      });

      const saved = await commentsRepo.save(comment);
      await postsRepo.increment({ id: postId }, 'commentsCount', 1);

      return {
        id: saved.id,
        text: saved.text,
        createdAt: saved.createdAt.toISOString(),
        updatedAt: saved.updatedAt.toISOString(),
        author: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          profilePictureUrl: user.profilePictureUrl ?? undefined,
        },
      };
    });
  }

  async deleteComment(
    userId: string,
    postId: string,
    commentId: string,
  ): Promise<MessageResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const commentsRepo = manager.getRepository(Comment);
      const postsRepo = manager.getRepository(PostEntity);

      const comment = await commentsRepo.findOne({
        where: { id: commentId, postId },
        select: ['id', 'userId', 'postId'],
      });
      if (!comment) throw new NotFoundException('Comment not found');

      if (comment.userId !== userId) {
        throw new ForbiddenException('You can only delete your own comments');
      }

      await commentsRepo.delete({ id: commentId });
      await postsRepo.decrement({ id: postId }, 'commentsCount', 1);

      return { message: 'Comment deleted' };
    });
  }
}
