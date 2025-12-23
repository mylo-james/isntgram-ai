import { ApiProperty } from '@nestjs/swagger';

export class PostLikeStatusDto {
  @ApiProperty({ example: true })
  isLiked!: boolean;

  @ApiProperty({ example: 12 })
  likeCount!: number;
}
