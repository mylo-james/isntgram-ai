import { ApiProperty } from '@nestjs/swagger';

export class AiCapabilitiesDto {
  @ApiProperty({ enum: ['disabled', 'mock', 'openai'] })
  mode!: 'disabled' | 'mock' | 'openai';

  @ApiProperty()
  available!: boolean;

  @ApiProperty()
  label!: string;
}
