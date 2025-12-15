import { ApiProperty } from '@nestjs/swagger';
import { AuthUserDto } from './auth-user.dto';

export class RegisterResponseDto {
  @ApiProperty()
  message!: string;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}
