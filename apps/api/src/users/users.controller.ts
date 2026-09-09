import {
  Controller,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  Put,
  Body,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt.guard';
import { AuthUser } from '../auth/jwt.types';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PublicUserProfileDto } from './dto/public-user-profile.dto';
import { PrivateUserProfileDto } from './dto/private-user-profile.dto';
import { UserSearchQueryDto } from './dto/user-search-query.dto';
import { UserSearchResponseDto } from './dto/user-search-response.dto';

const ONE_MINUTE_MS = 60_000;

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 240, ttl: ONE_MINUTE_MS } })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: PrivateUserProfileDto })
  async getCurrentUser(
    @Req() req: Request & { user: AuthUser },
  ): Promise<PrivateUserProfileDto> {
    return this.usersService.getPrivateProfileById(req.user.userId);
  }

  @Get('check-username/:username')
  @Throttle({ default: { limit: 60, ttl: ONE_MINUTE_MS } })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ schema: { example: { available: true } } })
  async checkUsername(
    @Param('username') username: string,
  ): Promise<{ available: boolean }> {
    const taken = await this.usersService.isUsernameTaken(username);
    return { available: !taken };
  }

  @Get('search')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 120, ttl: ONE_MINUTE_MS } })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: UserSearchResponseDto })
  async searchUsers(
    @Req() req: Request & { user: AuthUser },
    @Query() query: UserSearchQueryDto,
  ): Promise<UserSearchResponseDto> {
    return this.usersService.searchUsers(req.user.isDemoUser, query);
  }

  @Get(':username')
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 300, ttl: ONE_MINUTE_MS } })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: PublicUserProfileDto })
  async getUserProfile(
    @Req() req: Request & { user?: AuthUser | null },
    @Param('username') username: string,
  ): Promise<PublicUserProfileDto> {
    return this.usersService.getPublicProfile(
      username,
      Boolean(req.user?.isDemoUser),
    );
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: ONE_MINUTE_MS } })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: PrivateUserProfileDto })
  async updateProfile(
    @Req() req: Request & { user: AuthUser },
    @Body() body: UpdateProfileDto,
  ): Promise<PrivateUserProfileDto> {
    return this.usersService.updateProfile(req.user.userId, {
      fullName: body.fullName,
      username: body.username,
      profilePictureUploadId: body.profilePictureUploadId,
    });
  }
}
