import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LikesService } from './likes.service';
import { LikeDto } from './dto/like.dto';

@Controller('likes')
@UseGuards(ThrottlerGuard)
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async likePost(@Request() req: any, @Body() likeDto: LikeDto) {
    const userId = req.user.sub;
    return this.likesService.likePost(userId, likeDto);
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async unlikePost(@Request() req: any, @Body() likeDto: LikeDto) {
    const userId = req.user.sub;
    return this.likesService.unlikePost(userId, likeDto);
  }

  @Get('stats/:postId')
  async getLikeStats(
    @Request() req: any,
    @Param('postId') postId: string,
  ) {
    const userId = req.user?.sub;
    return this.likesService.getLikeStats(userId, postId);
  }

  @Get('post/:postId')
  async getPostLikes(
    @Param('postId') postId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.likesService.getPostLikes(
      postId,
      page ? parseInt(page.toString()) : 1,
      limit ? parseInt(limit.toString()) : 20,
    );
  }
}