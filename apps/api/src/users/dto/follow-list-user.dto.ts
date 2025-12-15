import { ApiProperty } from '@nestjs/swagger';
import { UserSummaryDto } from '../../common/dto/user-summary.dto';

export class FollowListUserDto extends UserSummaryDto {
  @ApiProperty()
  isFollowing!: boolean;
}
