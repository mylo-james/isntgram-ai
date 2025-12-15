import { ApiProperty } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { FollowListUserDto } from './follow-list-user.dto';

export class FollowListResponseDto {
  @ApiProperty({ type: [FollowListUserDto] })
  users!: FollowListUserDto[];

  @ApiProperty({ type: PaginationDto })
  pagination!: PaginationDto;
}
