import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommentDto } from './comment.dto';
import { PostAuthorDto } from './post-author.dto';

export class PostDto {
  @ApiPropertyOptional({
    maxLength: 1000,
    description: 'Author-written photo description.',
  })
  mediaAltText?: string;

  @ApiProperty({ example: '7c1a2f04-1cf3-4c75-b42f-8f6c0f3e4d5a' })
  id!: string;

  @ApiProperty({
    example: "Shipping a fresh batch of ideas after today's research sprint.",
  })
  content!: string;

  @ApiPropertyOptional({
    example: 'https://cdn.isntgram.ai/uploads/ava/post-cover.jpg',
  })
  mediaUrl?: string;

  @ApiProperty({ example: 0 })
  likeCount!: number;

  @ApiProperty({ example: 0 })
  commentCount!: number;

  @ApiProperty({
    type: [CommentDto],
    description:
      'Preview comments (up to 3) for feed/profile rendering without extra round-trips.',
  })
  previewComments!: CommentDto[];

  @ApiProperty({
    example: false,
    description:
      'Whether the current viewer has liked this post (false for anonymous viewers)',
  })
  likedByViewer!: boolean;

  @ApiProperty({ format: 'date-time', example: '2025-12-19T10:12:00.000Z' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time', example: '2025-12-19T10:12:00.000Z' })
  updatedAt!: string;

  @ApiProperty({ type: PostAuthorDto })
  author!: PostAuthorDto;
}
