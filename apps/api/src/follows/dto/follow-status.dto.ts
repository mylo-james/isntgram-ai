import { ApiProperty } from '@nestjs/swagger';

export class FollowStatusDto {
  @ApiProperty({ example: true })
  isFollowing!: boolean;
}
