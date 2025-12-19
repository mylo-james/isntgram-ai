import { ApiProperty } from '@nestjs/swagger';

export class UploadUrlDto {
  @ApiProperty({
    example:
      'https://s3.us-east-1.amazonaws.com/isntgram-media/uploads/ava/1702990000-uuid-photo.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...',
  })
  uploadUrl!: string;

  @ApiProperty({
    example: 'https://cdn.isntgram.ai/uploads/ava/1702990000-uuid-photo.jpg',
  })
  publicUrl!: string;

  @ApiProperty({ example: 'uploads/ava/1702990000-uuid-photo.jpg' })
  key!: string;

  @ApiProperty({ example: 900 })
  expiresIn!: number;
}
