import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PostDto } from './post.dto';

export class FeedResponseDto {
  @ApiProperty({
    type: [PostDto],
    example: [
      {
        id: '7c1a2f04-1cf3-4c75-b42f-8f6c0f3e4d5a',
        content:
          "Shipping a fresh batch of ideas after today's research sprint.",
        mediaUrl: 'https://cdn.isntgram.ai/uploads/ava/post-cover.jpg',
        createdAt: '2025-12-19T10:12:00.000Z',
        updatedAt: '2025-12-19T10:12:00.000Z',
        author: {
          id: 'b6cf7a42-3f7a-4a7b-97a2-6c8a13d7b56e',
          username: 'ava',
          fullName: 'Ava Thompson',
          profilePictureUrl: 'https://cdn.isntgram.ai/avatars/ava.jpg',
        },
      },
    ],
  })
  items!: PostDto[];

  @ApiPropertyOptional({
    description: 'Use as cursor for next page',
    example:
      'MjAyNS0xMi0xOVQxMDoxMjowMC4wMDBafDdjMWEyZjA0LTFjZjMtNGM3NS1iNDJmLThmNmMwZjNlNGQ1YQ==',
  })
  nextCursor?: string;
}
