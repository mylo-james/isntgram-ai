import {
  Controller,
  Post,
  Delete,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Get,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FollowsService } from './follows.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { Request } from 'express';
import { DemoReadOnlyGuard } from '../common/guards/demo-readonly.guard';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IsFollowingResponseDto } from './dto/is-following-response.dto';

interface AuthenticatedRequest extends Request {
  user?: { userId: string };
}

@ApiTags('Follows')
@ApiBearerAuth()
@Controller('users')
export class FollowsController {
  constructor(
    private readonly followsService: FollowsService,
    private readonly usersService: UsersService,
  ) {}

  @UseGuards(JwtAuthGuard, DemoReadOnlyGuard)
  @Post(':username/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Follow a user by username' })
  @ApiResponse({ status: 204, description: 'Followed successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async followUser(
    @Param('username') username: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    const target = await this.usersService.findByUsername(username);
    await this.followsService.followUser(req.user!.userId, target.id);
  }

  @UseGuards(JwtAuthGuard, DemoReadOnlyGuard)
  @Delete(':username/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unfollow a user by username' })
  @ApiResponse({ status: 204, description: 'Unfollowed successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async unfollowUser(
    @Param('username') username: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    const target = await this.usersService.findByUsername(username);
    await this.followsService.unfollowUser(req.user!.userId, target.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':username/is-following')
  @ApiOperation({ summary: 'Check if current user follows target by username' })
  @ApiOkResponse({ type: IsFollowingResponseDto })
  async isFollowing(
    @Param('username') username: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<IsFollowingResponseDto> {
    const target = await this.usersService.findByUsername(username);
    const isFollowing = await this.followsService.isFollowing(
      req.user!.userId,
      target.id,
    );
    return { isFollowing };
  }
}
