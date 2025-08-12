import {
  Controller,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  Query,
  Put,
  Body,
} from '@nestjs/common';
import { UsersService, UserProfileDto } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getCurrentUser(
    @Query('id') id?: string,
    @Query('email') email?: string,
  ): Promise<UserProfileDto> {
    if (id) {
      const user = await this.usersService.findById(id);
      return this.usersService.getUserProfile(user.username);
    }
    if (email) {
      const user = await this.usersService.findByEmail(email);
      return this.usersService.getUserProfile(user.username);
    }
    // Default fall back — not found behavior bubbles up
    return this.usersService.getUserProfile('');
  }

  @Get('check-username/:username')
  @HttpCode(HttpStatus.OK)
  async checkUsername(
    @Param('username') username: string,
  ): Promise<{ available: boolean }> {
    const taken = await this.usersService.isUsernameTaken(username);
    return { available: !taken };
  }

  @Get(':username')
  @HttpCode(HttpStatus.OK)
  async getUserProfile(
    @Param('username') username: string,
  ): Promise<UserProfileDto> {
    return this.usersService.getUserProfile(username);
  }

  @Get(':username/followers')
  @HttpCode(HttpStatus.OK)
  async getFollowers(
    @Param('username') username: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const parsedPage = Number(page) || 1;
    const parsedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    return this.usersService.getFollowers(username, parsedPage, parsedLimit);
  }

  @Get(':username/following')
  @HttpCode(HttpStatus.OK)
  async getFollowing(
    @Param('username') username: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const parsedPage = Number(page) || 1;
    const parsedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    return this.usersService.getFollowing(username, parsedPage, parsedLimit);
  }

  @Put('profile')
  @HttpCode(HttpStatus.OK)
  async updateProfile(@Body() body: UpdateProfileDto): Promise<UserProfileDto> {
    const updated = await this.usersService.updateProfile(body.id, {
      fullName: body.fullName,
      username: body.username,
    });
    return updated;
  }
}
