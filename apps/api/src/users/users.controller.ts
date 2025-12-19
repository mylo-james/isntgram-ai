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
} from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AuthUser } from '../auth/jwt.types';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PublicUserProfileDto } from './dto/public-user-profile.dto';
import { PrivateUserProfileDto } from './dto/private-user-profile.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: PrivateUserProfileDto })
  async getCurrentUser(
    @Req() req: Request & { user: AuthUser },
  ): Promise<PrivateUserProfileDto> {
    return this.usersService.getPrivateProfileById(req.user.userId);
  }

  @Get('check-username/:username')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ schema: { example: { available: true } } })
  async checkUsername(
    @Param('username') username: string,
  ): Promise<{ available: boolean }> {
    const taken = await this.usersService.isUsernameTaken(username);
    return { available: !taken };
  }

  @Get(':username')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: PublicUserProfileDto })
  async getUserProfile(
    @Param('username') username: string,
  ): Promise<PublicUserProfileDto> {
    return this.usersService.getPublicProfile(username);
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
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
    });
  }
}
