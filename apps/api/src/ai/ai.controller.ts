import {
  Body,
  Controller,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiBearerAuth, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiService } from './ai.service';
import { CaptionSuggestionsDto } from './dto/caption-suggestions.dto';
import { CaptionSuggestionsResponseDto } from './dto/caption-suggestions-response.dto';

type AuthenticatedRequest = Request & {
  user?: { userId: string; email: string; username: string };
};

@ApiTags('AI')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('captions')
  @Throttle({ default: { ttl: 3_600_000, limit: 10 } })
  @UseGuards(ThrottlerGuard, JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: CaptionSuggestionsResponseDto })
  async captions(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CaptionSuggestionsDto,
  ): Promise<CaptionSuggestionsResponseDto> {
    const user = req.user;
    if (!user) throw new UnauthorizedException();
    return this.aiService.captionSuggestions(user, dto);
  }
}
