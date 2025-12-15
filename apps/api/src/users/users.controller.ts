import {
  Controller,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  Query,
  Put,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { MyProfileDto } from './dto/my-profile.dto';
import { PublicUserProfileDto } from './dto/public-user-profile.dto';
import { UsernameAvailabilityDto } from './dto/username-availability.dto';
import { FollowListResponseDto } from './dto/follow-list-response.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { DemoReadOnlyGuard } from '../common/guards/demo-readonly.guard';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email?: string; username?: string };
}

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MyProfileDto })
  async getMe(@Req() req: AuthenticatedRequest): Promise<MyProfileDto> {
    const user = await this.usersService.findById(req.user!.userId);
    return this.usersService.toMyProfileDto(user);
  }

  @Get('check-username/:username')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: UsernameAvailabilityDto })
  async checkUsername(
    @Param('username') username: string,
  ): Promise<UsernameAvailabilityDto> {
    const taken = await this.usersService.isUsernameTaken(username);
    return { available: !taken };
  }

  @Get(':username')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: PublicUserProfileDto })
  async getUserProfile(
    @Param('username') username: string,
  ): Promise<PublicUserProfileDto> {
    return this.usersService.getUserProfile(username);
  }

  @Get(':username/followers')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOkResponse({ type: FollowListResponseDto })
  async getFollowers(
    @Param('username') username: string,
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const parsedPage = Number(page) || 1;
    const parsedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    return this.usersService.getFollowers(
      username,
      parsedPage,
      parsedLimit,
      req.user?.userId,
    );
  }

  @Get(':username/following')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOkResponse({ type: FollowListResponseDto })
  async getFollowing(
    @Param('username') username: string,
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const parsedPage = Number(page) || 1;
    const parsedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    return this.usersService.getFollowing(
      username,
      parsedPage,
      parsedLimit,
      req.user?.userId,
    );
  }

  @Put('profile')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, DemoReadOnlyGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MyProfileDto })
  async updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() body: UpdateMyProfileDto,
  ): Promise<MyProfileDto> {
    const updated = await this.usersService.updateProfile(req.user!.userId, {
      fullName: body.fullName,
      username: body.username,
    });
    return updated;
  }
}
