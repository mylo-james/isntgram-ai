import { ApiProperty } from '@nestjs/swagger';

export class UploadUrlDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'Owned pending upload intent. Supply this as mediaUploadId when creating the post.',
  })
  uploadId!: string;

  @ApiProperty({
    example:
      'https://s3.us-east-1.amazonaws.com/isntgram-media/pending/owner-uuid/upload-uuid?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...',
  })
  uploadUrl!: string;

  @ApiProperty({
    description:
      'Compatibility locator only. Pending objects are private and this URL cannot authorize a photo post.',
    example: 'https://cdn.isntgram.ai/pending/owner-uuid/upload-uuid',
  })
  publicUrl!: string;

  @ApiProperty({ example: 'pending/owner-uuid/upload-uuid' })
  key!: string;

  @ApiProperty({ example: 900 })
  expiresIn!: number;
}
