import { ApiProperty } from '@nestjs/swagger';

export class CaptionSuggestionsResponseDto {
  @ApiProperty({ type: [String], minItems: 1, maxItems: 5 })
  suggestions!: string[];
}
