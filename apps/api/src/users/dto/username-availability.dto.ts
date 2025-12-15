import { ApiProperty } from '@nestjs/swagger';

export class UsernameAvailabilityDto {
  @ApiProperty()
  available!: boolean;
}
