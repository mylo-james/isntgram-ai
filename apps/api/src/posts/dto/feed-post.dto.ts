import { ApiProperty } from '@nestjs/swagger';
import { UserSummaryDto } from '../../common/dto/user-summary.dto';

export class FeedPostDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ minLength: 1, maxLength: 2200 })
  content!: string;

  @ApiProperty({ minimum: 0 })
  likesCount!: number;

  @ApiProperty({ minimum: 0 })
  commentsCount!: number;

  @ApiProperty()
  likedByMe!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: UserSummaryDto })
  author!: UserSummaryDto;
}
