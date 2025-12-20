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
const parsedMaxBytes = Number(process.env.MEDIA_MAX_UPLOAD_BYTES);
const MAX_UPLOAD_BYTES =
  Number.isFinite(parsedMaxBytes) && parsedMaxBytes > 0
    ? parsedMaxBytes
    : DEFAULT_MAX_UPLOAD_BYTES;

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
