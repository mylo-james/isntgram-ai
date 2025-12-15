import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePostDto {
  @ApiProperty({ minLength: 1, maxLength: 2200 })
  @IsString()
  @MinLength(1)
  @MaxLength(2200)
  content!: string;
}
