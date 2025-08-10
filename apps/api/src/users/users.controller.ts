import { Controller, Get, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { UsersService, UserProfileDto } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':username')
  @HttpCode(HttpStatus.OK)
  async getUserProfile(
    @Param('username') username: string,
  ): Promise<UserProfileDto> {
    return this.usersService.getUserProfile(username);
  }
}
