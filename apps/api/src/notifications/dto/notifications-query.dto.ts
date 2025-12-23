import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationsQueryDto {
  @ApiPropertyOptional({
    description: 'Opaque cursor from previous page',
    example: 'MjAyNS0xMi0xOVQxMDoxMjowMC4wMDBafDEyMy1ub3RpZmljYXRpb24taWQ',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20, example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
