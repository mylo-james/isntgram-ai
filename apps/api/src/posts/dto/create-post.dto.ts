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
  @IsUrl({ require_protocol: true })
  @MaxLength(1000)
  mediaUrl?: string;
}
