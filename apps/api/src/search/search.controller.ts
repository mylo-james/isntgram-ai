import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchService } from './search.service';
import { SearchResponseDto } from './dto/search-response.dto';

type AuthenticatedRequest = Request & { user?: { userId: string } };

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOkResponse({ type: SearchResponseDto })
  async search(
    @Req() req: AuthenticatedRequest,
    @Query() query: SearchQueryDto,
  ): Promise<SearchResponseDto> {
    return this.searchService.search(query, req.user?.userId);
  }
}
