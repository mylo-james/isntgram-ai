import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const AI_TONES = ['professional', 'friendly', 'concise'] as const;
type AiRewriteTone = (typeof AI_TONES)[number];

export class AiRewriteRequestDto {
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
    enum: AI_TONES,
    default: 'professional',
  })
  @IsOptional()
  @IsIn(AI_TONES)
  tone?: AiRewriteTone;

  @ApiPropertyOptional({
    description: 'Maximum character length for the rewritten content',
    default: 2000,
    minimum: 1,
    maximum: 2000,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2000)
  maxLength?: number;
}

export class AiRewriteResponseDto {
  @ApiProperty({
    example:
      "Shipping a fresh batch of ideas after today's research sprint — distilled and ready to share.",
  })
  content!: string;

  @ApiProperty({
    enum: ['mock', 'openai'],
  })
  provider!: 'mock' | 'openai';

  @ApiPropertyOptional({
    example: 'gpt-4o-mini',
  })
  model?: string;
}
