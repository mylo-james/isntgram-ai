import { ApiProperty } from '@nestjs/swagger';

export class LikeStateResponseDto {
  @ApiProperty()
  likedByMe!: boolean;

  @ApiProperty({ minimum: 0 })
  likesCount!: number;
}
