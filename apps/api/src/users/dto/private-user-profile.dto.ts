import { ApiProperty } from '@nestjs/swagger';
import { PublicUserProfileDto } from './public-user-profile.dto';

export class PrivateUserProfileDto extends PublicUserProfileDto {
  @ApiProperty()
  email!: string;
}
