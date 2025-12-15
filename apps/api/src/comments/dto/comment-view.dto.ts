import { ApiProperty } from '@nestjs/swagger';
import { UserSummaryDto } from '../../common/dto/user-summary.dto';

export class CommentViewDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ minLength: 1, maxLength: 1000 })
  text!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: UserSummaryDto })
  author!: UserSummaryDto;
}
