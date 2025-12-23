import { ApiProperty } from '@nestjs/swagger';
import { PostAuthorDto } from './post-author.dto';

export class CommentDto {
  @ApiProperty({ example: '66efb64c-702f-46f5-9b44-7c9f2b0a0d61' })
  id!: string;

  @ApiProperty({ example: '7c1a2f04-1cf3-4c75-b42f-8f6c0f3e4d5a' })
  postId!: string;

  @ApiProperty({
    example: 'Great point — I ran into the same thing last week.',
  })
  content!: string;

  @ApiProperty({ example: 12 })
  likeCount!: number;

  @ApiProperty({
    example: false,
    description: 'Whether the authenticated viewer has liked this comment.',
  })
  likedByViewer!: boolean;

  @ApiProperty({ format: 'date-time', example: '2025-12-19T10:12:00.000Z' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time', example: '2025-12-19T10:12:00.000Z' })
  updatedAt!: string;

  @ApiProperty({ type: PostAuthorDto })
  author!: PostAuthorDto;
}
