import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PostLike } from './entities/post-like.entity';
import { Post } from '../posts/entities/post.entity';

export type LikeStateResponse = {
  likedByMe: boolean;
  likesCount: number;
};

@Injectable()
export class LikesService {
  constructor(
    @InjectRepository(PostLike)
    private readonly likesRepository: Repository<PostLike>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    private readonly dataSource: DataSource,
  ) {}

  async likePost(userId: string, postId: string): Promise<LikeStateResponse> {
    return this.dataSource.transaction(async (manager) => {
      const likesRepo = manager.getRepository(PostLike);
      const postsRepo = manager.getRepository(Post);

      const post = await postsRepo.findOne({
        where: { id: postId },
        select: ['id', 'likesCount'],
      });
      if (!post) throw new NotFoundException('Post not found');

      const insertResult = await likesRepo
        .createQueryBuilder()
        .insert()
        .into(PostLike)
        .values({ userId, postId })
        .orIgnore()
        .execute();

      if (insertResult.identifiers.length === 0) {
        // Already liked (unique constraint), keep counts unchanged.
        return { likedByMe: true, likesCount: post.likesCount };
      }

      await postsRepo.increment({ id: postId }, 'likesCount', 1);

      const updated = await postsRepo.findOne({
        where: { id: postId },
        select: ['id', 'likesCount'],
      });

      return {
        likedByMe: true,
        likesCount: updated?.likesCount ?? post.likesCount + 1,
      };
    });
  }

  async unlikePost(userId: string, postId: string): Promise<LikeStateResponse> {
    return this.dataSource.transaction(async (manager) => {
      const likesRepo = manager.getRepository(PostLike);
      const postsRepo = manager.getRepository(Post);

      const post = await postsRepo.findOne({
        where: { id: postId },
        select: ['id', 'likesCount'],
      });
      if (!post) throw new NotFoundException('Post not found');

      const deleted = await likesRepo.delete({ userId, postId });
      if (!deleted.affected) {
        return { likedByMe: false, likesCount: post.likesCount };
      }

      await postsRepo.decrement({ id: postId }, 'likesCount', 1);

      const updated = await postsRepo.findOne({
        where: { id: postId },
        select: ['id', 'likesCount'],
      });

      return {
        likedByMe: false,
        likesCount: Math.max(updated?.likesCount ?? post.likesCount - 1, 0),
      };
    });
  }
}
