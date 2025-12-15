import { ApiProperty } from '@nestjs/swagger';
import { PublicUserProfileDto } from './public-user-profile.dto';

export class MyProfileDto extends PublicUserProfileDto {
  @ApiProperty({ format: 'email' })
  email!: string;
}
