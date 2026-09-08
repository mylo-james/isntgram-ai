import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  IsUrl,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePostDto {
  @ApiPropertyOptional({
    maxLength: 1000,
    description: 'Author-written photo description, separate from the caption.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  mediaAltText?: string;

  @ApiProperty({
    minLength: 1,
    maxLength: 2000,
    example: "Shipping a fresh batch of ideas after today's research sprint.",
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;

  @ApiPropertyOptional({
    description:
      'Deprecated. New photo posts must use mediaUploadId; supplied media URLs are rejected.',
    deprecated: true,
    format: 'uri',
    maxLength: 1000,
    example: 'https://cdn.isntgram.ai/uploads/ava/post-cover.jpg',
  })
  @IsOptional()
  // Retained in the contract to return a clear migration error to older clients.
  @IsUrl({ require_protocol: true, require_tld: false })
  @MaxLength(1000)
  mediaUrl?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Owned upload intent returned by media presign.',
  })
  @IsOptional()
  @IsUUID()
  mediaUploadId?: string;
}
