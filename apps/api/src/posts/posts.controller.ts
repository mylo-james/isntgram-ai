import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { FeedQueryDto } from './dto/feed-query.dto';
import { DemoReadOnlyGuard } from '../common/guards/demo-readonly.guard';
import { FeedPostDto } from './dto/feed-post.dto';
import { FeedResponseDto } from './dto/feed-response.dto';
import { MessageResponseDto } from '../common/dto/message-response.dto';

type AuthenticatedRequest = Request & {
  user?: { userId: string; email: string; username: string };
};

@ApiTags('Posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get('explore')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOkResponse({ type: FeedResponseDto })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async explore(
    @Req() req: AuthenticatedRequest,
    @Query() query: FeedQueryDto,
  ) {
    return this.postsService.getExplore(req.user?.userId, query);
  }

  @Get('feed')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: FeedResponseDto })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async feed(@Req() req: AuthenticatedRequest, @Query() query: FeedQueryDto) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException();
    return this.postsService.getFeed(userId, query);
  }

  @Post()
  @UseGuards(JwtAuthGuard, DemoReadOnlyGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: FeedPostDto })
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreatePostDto) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException();
    return this.postsService.createPost(userId, dto);
  }

  @Get('user/:username')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOkResponse({ type: FeedResponseDto })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async byUser(
    @Req() req: AuthenticatedRequest,
    @Param('username') username: string,
    @Query() query: FeedQueryDto,
  ) {
    return this.postsService.getPostsByUsername(
      username,
      query,
      req.user?.userId,
    );
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOkResponse({ type: FeedPostDto })
  async getOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.postsService.getPostById(id, req.user?.userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, DemoReadOnlyGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MessageResponseDto })
  async delete(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException();
    await this.postsService.deletePost(userId, id);
    return { message: 'Post deleted' };
  }
}
