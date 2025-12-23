import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post as HttpPost,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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
import { OptionalJwtAuthGuard } from '../auth/optional-jwt.guard';
import { AuthUser } from '../auth/jwt.types';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { FeedQueryDto } from './dto/feed-query.dto';
import { FeedResponseDto } from './dto/feed-response.dto';
import { PostDto } from './dto/post.dto';
import { PostLikeStatusDto } from './dto/post-like-status.dto';
import { CommentLikeStatusDto } from './dto/comment-like-status.dto';
import { CommentsResponseDto } from './dto/comments-response.dto';
import { CommentDto } from './dto/comment.dto';
import { ApiErrorDto } from '../common/dto/api-error.dto';

const POST_EXAMPLE = {
  id: '7c1a2f04-1cf3-4c75-b42f-8f6c0f3e4d5a',
  content: "Shipping a fresh batch of ideas after today's research sprint.",
  mediaUrl: 'https://cdn.isntgram.ai/uploads/ava/post-cover.jpg',
  likeCount: 12,
  commentCount: 3,
  previewComments: [],
  likedByViewer: false,
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
const ONE_MINUTE_MS = 60_000;

@ApiTags('posts')
@ApiExtraModels(
  PostDto,
  FeedResponseDto,
  PostLikeStatusDto,
  CommentLikeStatusDto,
  CommentDto,
  CommentsResponseDto,
  ApiErrorDto,
)
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 30, ttl: ONE_MINUTE_MS } })
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
  @Throttle({ default: { limit: 120, ttl: ONE_MINUTE_MS } })
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
    return this.postsService.getFeed(
      req.user.userId,
      req.user.isDemoUser,
      query,
    );
  }

  @Get('user/:username')
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 300, ttl: ONE_MINUTE_MS } })
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
    @Req() req: Request & { user?: AuthUser | null },
    @Param('username') username: string,
    @Query() query: FeedQueryDto,
  ): Promise<FeedResponseDto> {
    return this.postsService.getUserPosts(
      username,
      { isDemoUser: Boolean(req.user?.isDemoUser), userId: req.user?.userId },
      query,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 120, ttl: ONE_MINUTE_MS } })
  @ApiBearerAuth()
  @Get('explore')
  @ApiOkResponse({
    description: 'Explore results',
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
  async getExplore(
    @Req() req: Request & { user: AuthUser },
    @Query() query: FeedQueryDto,
  ): Promise<FeedResponseDto> {
    return this.postsService.getExplore(
      req.user.userId,
      req.user.isDemoUser,
      query,
    );
  }

  @Get(':postId')
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 300, ttl: ONE_MINUTE_MS } })
  @ApiOkResponse({
    description: 'Post details',
    schema: {
      allOf: [{ $ref: getSchemaPath(PostDto) }],
      example: POST_EXAMPLE,
    },
  })
  @ApiNotFoundResponse({
    description: 'Post not found',
    type: ApiErrorDto,
  })
  async getPost(
    @Req() req: Request & { user?: AuthUser | null },
    @Param('postId') postId: string,
  ): Promise<PostDto> {
    return this.postsService.getPost(postId, {
      isDemoUser: Boolean(req.user?.isDemoUser),
      userId: req.user?.userId,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 120, ttl: ONE_MINUTE_MS } })
  @ApiBearerAuth()
  @HttpPost(':postId/like')
  @ApiOkResponse({
    description: 'Liked post',
    schema: {
      allOf: [{ $ref: getSchemaPath(PostLikeStatusDto) }],
      example: { isLiked: true, likeCount: 12 },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ApiErrorDto,
  })
  @ApiNotFoundResponse({
    description: 'Post not found',
    type: ApiErrorDto,
  })
  async likePost(
    @Req() req: Request & { user: AuthUser },
    @Param('postId') postId: string,
  ): Promise<PostLikeStatusDto> {
    return this.postsService.likePost(
      req.user.userId,
      req.user.isDemoUser,
      postId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 120, ttl: ONE_MINUTE_MS } })
  @ApiBearerAuth()
  @Delete(':postId/like')
  @ApiOkResponse({
    description: 'Unliked post',
    schema: {
      allOf: [{ $ref: getSchemaPath(PostLikeStatusDto) }],
      example: { isLiked: false, likeCount: 11 },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ApiErrorDto,
  })
  @ApiNotFoundResponse({
    description: 'Post not found',
    type: ApiErrorDto,
  })
  async unlikePost(
    @Req() req: Request & { user: AuthUser },
    @Param('postId') postId: string,
  ): Promise<PostLikeStatusDto> {
    return this.postsService.unlikePost(
      req.user.userId,
      req.user.isDemoUser,
      postId,
    );
  }

  @Get(':postId/comments')
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 300, ttl: ONE_MINUTE_MS } })
  @ApiOkResponse({
    description: 'Comment list',
    schema: {
      allOf: [{ $ref: getSchemaPath(CommentsResponseDto) }],
      example: { items: [] },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid cursor',
    type: ApiErrorDto,
  })
  @ApiNotFoundResponse({
    description: 'Post not found',
    type: ApiErrorDto,
  })
  async getComments(
    @Req() req: Request & { user?: AuthUser | null },
    @Param('postId') postId: string,
    @Query() query: FeedQueryDto,
  ): Promise<CommentsResponseDto> {
    return this.postsService.getComments(
      postId,
      { isDemoUser: Boolean(req.user?.isDemoUser), userId: req.user?.userId },
      query,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 120, ttl: ONE_MINUTE_MS } })
  @ApiBearerAuth()
  @HttpPost(':postId/comments')
  @ApiCreatedResponse({
    description: 'Comment created',
    schema: {
      allOf: [{ $ref: getSchemaPath(CommentDto) }],
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
  @ApiNotFoundResponse({
    description: 'Post not found',
    type: ApiErrorDto,
  })
  async createComment(
    @Req() req: Request & { user: AuthUser },
    @Param('postId') postId: string,
    @Body() body: CreateCommentDto,
  ): Promise<CommentDto> {
    return this.postsService.createComment(
      req.user.userId,
      req.user.isDemoUser,
      postId,
      body,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 240, ttl: ONE_MINUTE_MS } })
  @ApiBearerAuth()
  @HttpPost(':postId/comments/:commentId/like')
  @ApiOkResponse({
    description: 'Liked comment',
    schema: {
      allOf: [{ $ref: getSchemaPath(CommentLikeStatusDto) }],
      example: { isLiked: true, likeCount: 4 },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ApiErrorDto,
  })
  @ApiNotFoundResponse({
    description: 'Post or comment not found',
    type: ApiErrorDto,
  })
  async likeComment(
    @Req() req: Request & { user: AuthUser },
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
  ): Promise<CommentLikeStatusDto> {
    return this.postsService.likeComment(
      req.user.userId,
      req.user.isDemoUser,
      postId,
      commentId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 240, ttl: ONE_MINUTE_MS } })
  @ApiBearerAuth()
  @Delete(':postId/comments/:commentId/like')
  @ApiOkResponse({
    description: 'Unliked comment',
    schema: {
      allOf: [{ $ref: getSchemaPath(CommentLikeStatusDto) }],
      example: { isLiked: false, likeCount: 3 },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ApiErrorDto,
  })
  @ApiNotFoundResponse({
    description: 'Post or comment not found',
    type: ApiErrorDto,
  })
  async unlikeComment(
    @Req() req: Request & { user: AuthUser },
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
  ): Promise<CommentLikeStatusDto> {
    return this.postsService.unlikeComment(
      req.user.userId,
      req.user.isDemoUser,
      postId,
      commentId,
    );
  }
}
