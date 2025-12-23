import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePostDto {
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
    format: 'uri',
    maxLength: 1000,
    example: 'https://cdn.isntgram.ai/uploads/ava/post-cover.jpg',
  })
  @IsOptional()
  // Allow localhost URLs for local MinIO dev (host allowlist is enforced in PostsService).
  @IsUrl({ require_protocol: true, require_tld: false })
  @MaxLength(1000)
  mediaUrl?: string;
}
