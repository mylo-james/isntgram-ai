import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { User } from '../users/entities/user.entity';
import { Post } from '../posts/entities/post.entity';
import { PostLike } from '../likes/entities/post-like.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Post, PostLike])],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
