import { ApiProperty } from '@nestjs/swagger';

export class IsFollowingResponseDto {
  @ApiProperty()
  isFollowing!: boolean;
}
