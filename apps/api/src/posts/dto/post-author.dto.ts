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
