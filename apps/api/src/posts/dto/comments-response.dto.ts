import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommentDto } from './comment.dto';

export class CommentsResponseDto {
  @ApiProperty({ type: [CommentDto] })
  items!: CommentDto[];

  @ApiPropertyOptional({
    description: 'Opaque cursor from previous page',
    example:
      'MjAyNS0xMi0xOVQxMDoxMjowMC4wMDBafDY2ZWZiNjRjLTcwMmYtNDZmNS05YjQ0LTdjOWYyYjBhMGQ2MQ==',
  })
  nextCursor?: string;
}
