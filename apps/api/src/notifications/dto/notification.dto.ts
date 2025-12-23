import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationActorDto {
  @ApiProperty({ example: 'b6cf7a42-3f7a-4a7b-97a2-6c8a13d7b56e' })
  id!: string;

  @ApiProperty({ example: 'ava' })
  username!: string;

  @ApiProperty({ example: 'Ava Thompson' })
  fullName!: string;

  @ApiPropertyOptional({ example: 'https://cdn.isntgram.ai/avatars/ava.jpg' })
  profilePictureUrl?: string;
}

export class NotificationDto {
  @ApiProperty({ example: '66efb64c-702f-46f5-9b44-7c9f2b0a0d61' })
  id!: string;

  @ApiProperty({
    example: 'like',
    enum: ['follow', 'like', 'comment'],
  })
  type!: 'follow' | 'like' | 'comment';

  @ApiProperty({ format: 'date-time', example: '2025-12-19T10:12:00.000Z' })
  createdAt!: string;

  @ApiPropertyOptional({
    format: 'date-time',
    example: '2025-12-19T10:12:00.000Z',
  })
  readAt?: string;

  @ApiProperty({ type: NotificationActorDto })
  actor!: NotificationActorDto;

  @ApiPropertyOptional({
    example: '7c1a2f04-1cf3-4c75-b42f-8f6c0f3e4d5a',
    description: 'Associated post id (for like/comment notifications).',
  })
  postId?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.isntgram.ai/uploads/ava/post-cover.jpg',
    description: 'Associated post media url (for like/comment notifications).',
  })
  postMediaUrl?: string;

  @ApiPropertyOptional({
    example: '66efb64c-702f-46f5-9b44-7c9f2b0a0d61',
    description: 'Associated comment id (for comment notifications).',
  })
  commentId?: string;
}
