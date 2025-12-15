import { ApiProperty } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CommentViewDto } from './comment-view.dto';

export class CommentsResponseDto {
  @ApiProperty({ type: [CommentViewDto] })
  comments!: CommentViewDto[];

  @ApiProperty({ type: PaginationDto })
  pagination!: PaginationDto;
}
