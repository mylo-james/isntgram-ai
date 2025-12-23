import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiErrorDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: '2025-12-19T12:34:56.789Z' })
  timestamp!: string;

  @ApiProperty({ example: '/api/posts/feed?limit=20' })
  path!: string;

  @ApiPropertyOptional({
    example: 'req_9a6b3f0c-4a0a-4f11-9c61-2f6a3c5d1b2c',
  })
  requestId?: string;

  @ApiProperty({ example: 'Invalid cursor' })
  message!: string;

  @ApiPropertyOptional({
    example: ['username must be longer than or equal to 3 characters'],
  })
  errors?: string[];

  @ApiProperty({ example: 'BadRequestException' })
  error!: string;
}
