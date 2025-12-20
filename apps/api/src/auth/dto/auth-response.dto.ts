import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PrivateUserProfileDto } from '../../users/dto/private-user-profile.dto';

export class AuthRegisterResponseDto {
  @ApiProperty()
  message!: string;

  @ApiProperty({ type: PrivateUserProfileDto })
  user!: PrivateUserProfileDto;
}

export class AuthLoginResponseDto {
  @ApiProperty()
  message!: string;

  @ApiProperty({ type: PrivateUserProfileDto })
  user!: PrivateUserProfileDto;

  @ApiProperty()
  accessToken!: string;

  @ApiPropertyOptional()
  isDemoUser?: boolean;
}

export class AuthLogoutResponseDto {
  @ApiProperty()
  message!: string;
}
