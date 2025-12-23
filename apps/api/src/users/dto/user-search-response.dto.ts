import { ApiProperty } from '@nestjs/swagger';
import { UserSearchItemDto } from './user-search-item.dto';

export class UserSearchResponseDto {
  @ApiProperty({ type: [UserSearchItemDto] })
  items!: UserSearchItemDto[];
}
