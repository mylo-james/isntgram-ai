import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
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
import { FollowsService } from './follows.service';
import { FollowStatusDto } from './dto/follow-status.dto';
import { ApiErrorDto } from '../common/dto/api-error.dto';

const FOLLOW_STATUS_EXAMPLE = { isFollowing: true };

@ApiTags('follows')
@ApiExtraModels(FollowStatusDto, ApiErrorDto)
@Controller('follows')
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':username/status')
  @ApiOkResponse({
    description: 'Follow status',
    schema: {
      allOf: [{ $ref: getSchemaPath(FollowStatusDto) }],
      example: FOLLOW_STATUS_EXAMPLE,
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ApiErrorDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    type: ApiErrorDto,
  })
  async getFollowStatus(
    @Req() req: Request & { user: AuthUser },
    @Param('username') username: string,
  ): Promise<FollowStatusDto> {
    return this.followsService.getFollowStatus(req.user.userId, username);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post(':username')
  @ApiOkResponse({
    description: 'Followed user',
    schema: {
      allOf: [{ $ref: getSchemaPath(FollowStatusDto) }],
      example: FOLLOW_STATUS_EXAMPLE,
    },
  })
  @ApiBadRequestResponse({
    description: 'Cannot follow yourself',
    type: ApiErrorDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ApiErrorDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    type: ApiErrorDto,
  })
  async followUser(
    @Req() req: Request & { user: AuthUser },
    @Param('username') username: string,
  ): Promise<FollowStatusDto> {
    return this.followsService.followUser(req.user.userId, username);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete(':username')
  @ApiOkResponse({
    description: 'Unfollowed user',
    schema: {
      allOf: [{ $ref: getSchemaPath(FollowStatusDto) }],
      example: { isFollowing: false },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ApiErrorDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    type: ApiErrorDto,
  })
  async unfollowUser(
    @Req() req: Request & { user: AuthUser },
    @Param('username') username: string,
  ): Promise<FollowStatusDto> {
    return this.followsService.unfollowUser(req.user.userId, username);
  }
}
