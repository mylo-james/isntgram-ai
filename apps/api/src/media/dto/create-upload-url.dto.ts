import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsString,
  Max,
  MaxLength,
  MinLength,
  Min,
} from 'class-validator';

const DEFAULT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
// OpenAPI contracts should be deterministic. Runtime configuration may further
// restrict uploads (see MediaService), but the public contract caps at 5MB.
const MAX_UPLOAD_BYTES = DEFAULT_MAX_UPLOAD_BYTES;

export class CreateUploadUrlDto {
  @ApiProperty({ example: 'photo.jpg' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fileName!: string;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  contentType!: string;

  @ApiProperty({
    example: 245000,
    maximum: MAX_UPLOAD_BYTES,
    description: 'File size in bytes',
  })
  @IsInt()
  @Min(1)
  @Max(MAX_UPLOAD_BYTES)
  contentLength!: number;
}
