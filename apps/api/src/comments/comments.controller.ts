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
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DemoReadOnlyGuard } from '../common/guards/demo-readonly.guard';
import { FeedQueryDto } from '../posts/dto/feed-query.dto';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentViewDto } from './dto/comment-view.dto';
import { CommentsResponseDto } from './dto/comments-response.dto';
import { MessageResponseDto } from '../common/dto/message-response.dto';

type AuthenticatedRequest = Request & {
  user?: { userId: string; email: string; username: string };
};

@ApiTags('Comments')
@Controller('posts')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get(':postId/comments')
  @ApiOkResponse({ type: CommentsResponseDto })
  async list(
    @Param('postId') postId: string,
    @Query() query: FeedQueryDto,
  ): Promise<CommentsResponseDto> {
    return this.commentsService.getComments(postId, query.page, query.limit);
  }

  @Post(':postId/comments')
  @UseGuards(JwtAuthGuard, DemoReadOnlyGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: CommentViewDto })
  async create(
    @Req() req: AuthenticatedRequest,
    @Param('postId') postId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentViewDto> {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException();
    return this.commentsService.createComment(userId, postId, dto);
  }

  @Delete(':postId/comments/:commentId')
  @UseGuards(JwtAuthGuard, DemoReadOnlyGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MessageResponseDto })
  async delete(
    @Req() req: AuthenticatedRequest,
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
  ): Promise<MessageResponseDto> {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException();
    return this.commentsService.deleteComment(userId, postId, commentId);
  }
}
