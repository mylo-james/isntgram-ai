import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post as PostEntity } from './entities/post.entity';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { User } from '../users/entities/user.entity';
import { CommonModule } from '../common/common.module';
import { PostLike } from '../likes/entities/post-like.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PostEntity, User, PostLike]),
    CommonModule,
  ],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
