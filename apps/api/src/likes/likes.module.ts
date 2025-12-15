import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostLike } from './entities/post-like.entity';
import { LikesService } from './likes.service';
import { LikesController } from './likes.controller';
import { Post } from '../posts/entities/post.entity';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [TypeOrmModule.forFeature([PostLike, Post]), CommonModule],
  providers: [LikesService],
  controllers: [LikesController],
  exports: [LikesService],
})
export class LikesModule {}
