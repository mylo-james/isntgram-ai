import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Follows } from './entities/follows.entity';
import { FollowsService } from './follows.service';
import { FollowsController } from './follows.controller';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Follows, User]),
    UsersModule,
    CommonModule,
  ],
  controllers: [FollowsController],
  providers: [FollowsService],
  exports: [FollowsService],
})
export class FollowsModule {}
