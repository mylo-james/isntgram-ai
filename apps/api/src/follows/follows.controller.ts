import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FollowsService } from './follows.service';
import { FollowDto } from './dto/follow.dto';

@Controller('follows')
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async followUser(@Request() req: any, @Body() followDto: FollowDto) {
    const followerId = req.user.sub;
    return this.followsService.followUser(followerId, followDto);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async unfollowUser(@Request() req: any, @Body() followDto: FollowDto) {
    const followerId = req.user.sub;
    return this.followsService.unfollowUser(followerId, followDto);
  }

  @Get('stats/:userId')
  async getFollowStats(@Request() req: any, @Param('userId') userId: string) {
    const currentUserId = req.user.sub;
    return this.followsService.getFollowStats(currentUserId, userId);
  }

  @Get('followers/:userId')
  async getFollowers(@Param('userId') userId: string) {
    return this.followsService.getFollowers(userId);
  }

  @Get('following/:userId')
  async getFollowing(@Param('userId') userId: string) {
    return this.followsService.getFollowing(userId);
  }
}