import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AuthUser } from '../auth/jwt.types';
import { ApiErrorDto } from '../common/dto/api-error.dto';
import { AiService } from './ai.service';
import {
  AiRewriteRequestDto,
  AiRewriteResponseDto,
} from './dto/ai-rewrite.dto';

const REWRITE_EXAMPLE = {
  content:
    "Shipping a fresh batch of ideas after today's research sprint — distilled and ready to share.",
  provider: 'mock',
};

@ApiTags('ai')
@ApiExtraModels(AiRewriteResponseDto, ApiErrorDto)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('rewrite')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'Rewrite post content using an AI provider',
    schema: {
      allOf: [{ $ref: getSchemaPath(AiRewriteResponseDto) }],
      example: REWRITE_EXAMPLE,
    },
  })
  @ApiBadRequestResponse({
    description: 'Validation error',
    type: ApiErrorDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ApiErrorDto,
  })
  async rewrite(
    @Req() req: Request & { user: AuthUser },
    @Body() body: AiRewriteRequestDto,
  ): Promise<AiRewriteResponseDto> {
    return this.aiService.rewrite(req.user.userId, body);
  }
}
