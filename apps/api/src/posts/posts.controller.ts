import {
  Body,
  Controller,
  Get,
  Param,
  Post as HttpPost,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiTags,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AuthUser } from '../auth/jwt.types';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { FeedQueryDto } from './dto/feed-query.dto';
import { FeedResponseDto } from './dto/feed-response.dto';
import { PostDto } from './dto/post.dto';
import { ApiErrorDto } from '../common/dto/api-error.dto';

const POST_EXAMPLE = {
  id: '7c1a2f04-1cf3-4c75-b42f-8f6c0f3e4d5a',
  content: "Shipping a fresh batch of ideas after today's research sprint.",
  mediaUrl: 'https://cdn.isntgram.ai/uploads/ava/post-cover.jpg',
  createdAt: '2025-12-19T10:12:00.000Z',
  updatedAt: '2025-12-19T10:12:00.000Z',
  author: {
    id: 'b6cf7a42-3f7a-4a7b-97a2-6c8a13d7b56e',
    username: 'ava',
    fullName: 'Ava Thompson',
    profilePictureUrl: 'https://cdn.isntgram.ai/avatars/ava.jpg',
  },
};

const FEED_EXAMPLE = {
  items: [POST_EXAMPLE],
  nextCursor:
    'MjAyNS0xMi0xOVQxMDoxMjowMC4wMDBafDdjMWEyZjA0LTFjZjMtNGM3NS1iNDJmLThmNmMwZjNlNGQ1YQ==',
};

@ApiTags('posts')
@ApiExtraModels(PostDto, FeedResponseDto, ApiErrorDto)
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpPost()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({
    description: 'Post created',
    schema: {
      allOf: [{ $ref: getSchemaPath(PostDto) }],
      example: POST_EXAMPLE,
    },
  })
  @ApiBadRequestResponse({
    description: 'Validation error',
    type: ApiErrorDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ApiErrorDto,
  })
  async createPost(
    @Req() req: Request & { user: AuthUser },
    @Body() body: CreatePostDto,
  ): Promise<PostDto> {
    return this.postsService.createPost(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('feed')
  @ApiOkResponse({
    description: 'Feed results',
    schema: {
      allOf: [{ $ref: getSchemaPath(FeedResponseDto) }],
      example: FEED_EXAMPLE,
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid cursor',
    type: ApiErrorDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ApiErrorDto,
  })
  async getFeed(
    @Req() req: Request & { user: AuthUser },
    @Query() query: FeedQueryDto,
  ): Promise<FeedResponseDto> {
    return this.postsService.getFeed(req.user.userId, query);
  }

  @Get('user/:username')
  @ApiOkResponse({
    description: 'User posts',
    schema: {
      allOf: [{ $ref: getSchemaPath(FeedResponseDto) }],
      example: FEED_EXAMPLE,
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid cursor',
    type: ApiErrorDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    type: ApiErrorDto,
  })
  async getUserPosts(
    @Param('username') username: string,
    @Query() query: FeedQueryDto,
  ): Promise<FeedResponseDto> {
    return this.postsService.getUserPosts(username, query);
  }
}
