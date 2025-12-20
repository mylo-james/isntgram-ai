import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiInternalServerErrorResponse,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AuthUser } from '../auth/jwt.types';
import { MediaService } from './media.service';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import { UploadUrlDto } from './dto/upload-url.dto';
import { ApiErrorDto } from '../common/dto/api-error.dto';
import { ThrottlerGuard } from '@nestjs/throttler';

const UPLOAD_URL_EXAMPLE = {
  uploadUrl:
    'https://s3.us-east-1.amazonaws.com/isntgram-media/uploads/ava/1702990000-uuid-photo.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...',
  publicUrl: 'https://cdn.isntgram.ai/uploads/ava/1702990000-uuid-photo.jpg',
  key: 'uploads/ava/1702990000-uuid-photo.jpg',
  expiresIn: 900,
};

@ApiTags('media')
@ApiExtraModels(UploadUrlDto, ApiErrorDto)
@Controller('media')
@UseGuards(ThrottlerGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('presign')
  @ApiOkResponse({
    description: 'Presigned upload URL',
    schema: {
      allOf: [{ $ref: getSchemaPath(UploadUrlDto) }],
      example: UPLOAD_URL_EXAMPLE,
    },
  })
  @ApiBadRequestResponse({
    description: 'Unsupported media type',
    type: ApiErrorDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ApiErrorDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Media storage is not configured',
    type: ApiErrorDto,
  })
  async createUploadUrl(
    @Req() req: Request & { user: AuthUser },
    @Body() body: CreateUploadUrlDto,
  ): Promise<UploadUrlDto> {
    return this.mediaService.createUploadUrl({
      userId: req.user.userId,
      fileName: body.fileName,
      contentType: body.contentType,
      contentLength: body.contentLength,
    });
  }
}
