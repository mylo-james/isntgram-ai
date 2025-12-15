import {
  Controller,
  Delete,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DemoReadOnlyGuard } from '../common/guards/demo-readonly.guard';
import { LikesService } from './likes.service';
import { LikeStateResponseDto } from './dto/like-state-response.dto';

type AuthenticatedRequest = Request & {
  user?: { userId: string; email: string; username: string };
};

@ApiTags('Likes')
@Controller('posts')
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post(':postId/like')
  @UseGuards(JwtAuthGuard, DemoReadOnlyGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: LikeStateResponseDto })
  async like(
    @Req() req: AuthenticatedRequest,
    @Param('postId') postId: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException();
    return this.likesService.likePost(userId, postId);
  }

  @Delete(':postId/like')
  @UseGuards(JwtAuthGuard, DemoReadOnlyGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: LikeStateResponseDto })
  async unlike(
    @Req() req: AuthenticatedRequest,
    @Param('postId') postId: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException();
    return this.likesService.unlikePost(userId, postId);
  }
}
