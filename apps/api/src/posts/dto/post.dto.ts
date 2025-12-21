import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PostAuthorDto {
  @ApiProperty({ example: 'b6cf7a42-3f7a-4a7b-97a2-6c8a13d7b56e' })
  id!: string;

  @ApiProperty({ example: 'ava' })
  username!: string;

  @ApiProperty({ example: 'Ava Thompson' })
  fullName!: string;

  @ApiPropertyOptional({ example: 'https://cdn.isntgram.ai/avatars/ava.jpg' })
  profilePictureUrl?: string;
}

export class PostDto {
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

  @ApiProperty({ format: 'date-time', example: '2025-12-19T10:12:00.000Z' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time', example: '2025-12-19T10:12:00.000Z' })
  updatedAt!: string;

  @ApiProperty({ type: PostAuthorDto })
  author!: PostAuthorDto;
}
