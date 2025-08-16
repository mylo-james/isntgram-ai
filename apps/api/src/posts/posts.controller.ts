import {
  Controller,
  Post,
  Get,
  Delete,
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
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';

@Controller('posts')
@UseGuards(ThrottlerGuard)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createPost(@Request() req: any, @Body() createPostDto: CreatePostDto) {
    const userId = req.user.sub;
    return this.postsService.createPost(userId, createPostDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deletePost(@Request() req: any, @Param('id') postId: string) {
    const userId = req.user.sub;
    return this.postsService.deletePost(userId, postId);
  }

  @Get(':id')
  async getPost(@Param('id') postId: string) {
    return this.postsService.getPost(postId);
  }

  @Get('user/:username')
  async getUserPosts(
    @Param('username') username: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.postsService.getUserPosts(
      username,
      page ? parseInt(page.toString()) : 1,
      limit ? parseInt(limit.toString()) : 12,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getFeed(
    @Request() req: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const userId = req.user.sub;
    return this.postsService.getFeed(
      userId,
      page ? parseInt(page.toString()) : 1,
      limit ? parseInt(limit.toString()) : 10,
    );
  }
}