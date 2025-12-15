import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FollowRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  targetUserId!: string;
}
