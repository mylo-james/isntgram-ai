import { ApiProperty } from '@nestjs/swagger';
import { FeedPostDto } from './feed-post.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class FeedResponseDto {
  @ApiProperty({ type: [FeedPostDto] })
  posts!: FeedPostDto[];

  @ApiProperty({ type: PaginationDto })
  pagination!: PaginationDto;
}
