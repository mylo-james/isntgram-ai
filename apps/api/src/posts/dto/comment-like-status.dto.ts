import { ApiProperty } from '@nestjs/swagger';

export class CommentLikeStatusDto {
  @ApiProperty({ example: true })
  isLiked!: boolean;

  @ApiProperty({ example: 12 })
  likeCount!: number;
}
