import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum CaptionTone {
  Friendly = 'friendly',
  Funny = 'funny',
  Professional = 'professional',
  Poetic = 'poetic',
  Concise = 'concise',
}

export class CaptionSuggestionsDto {
  @ApiProperty({ minLength: 5, maxLength: 500 })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  prompt!: string;

  @ApiPropertyOptional({ enum: CaptionTone })
  @IsOptional()
  @IsEnum(CaptionTone)
  tone?: CaptionTone;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  count?: number;
}
