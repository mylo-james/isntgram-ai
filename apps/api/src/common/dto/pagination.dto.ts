import { ApiProperty } from '@nestjs/swagger';

export class PaginationDto {
  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1 })
  limit!: number;

  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty()
  hasMore!: boolean;
}
