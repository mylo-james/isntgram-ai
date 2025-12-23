import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UserSearchQueryDto {
  @ApiProperty({
    description: 'Search term (username or name).',
    minLength: 1,
    maxLength: 50,
    example: 'ava',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  q!: string;

  @ApiPropertyOptional({
    description: 'Maximum number of results.',
    minimum: 1,
    maximum: 20,
    default: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}
