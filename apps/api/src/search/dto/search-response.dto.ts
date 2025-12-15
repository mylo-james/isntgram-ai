import { ApiProperty } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { UserSummaryDto } from '../../common/dto/user-summary.dto';
import { FeedPostDto } from '../../posts/dto/feed-post.dto';

export class SearchResponseDto {
  @ApiProperty()
  query!: string;

  @ApiProperty({ type: [UserSummaryDto] })
  users!: UserSummaryDto[];

  @ApiProperty({ type: [FeedPostDto] })
  posts!: FeedPostDto[];

  @ApiProperty({ type: PaginationDto })
  usersPagination!: PaginationDto;

  @ApiProperty({ type: PaginationDto })
  postsPagination!: PaginationDto;
}
