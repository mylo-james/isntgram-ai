import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AuthUser } from '../auth/jwt.types';
import { ApiErrorDto } from '../common/dto/api-error.dto';
import { NotificationsQueryDto } from './dto/notifications-query.dto';
import { NotificationsResponseDto } from './dto/notifications-response.dto';
import { NotificationDto } from './dto/notification.dto';
import { NotificationsService } from './notifications.service';

const ONE_MINUTE_MS = 60_000;

@ApiTags('notifications')
@ApiExtraModels(NotificationDto, NotificationsResponseDto, ApiErrorDto)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 120, ttl: ONE_MINUTE_MS } })
  @ApiBearerAuth()
  @Get()
  @ApiOkResponse({
    description: 'Notifications list',
    schema: {
      allOf: [{ $ref: getSchemaPath(NotificationsResponseDto) }],
      example: { items: [] },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid cursor',
    type: ApiErrorDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ApiErrorDto,
  })
  async getNotifications(
    @Req() req: Request & { user: AuthUser },
    @Query() query: NotificationsQueryDto,
  ): Promise<NotificationsResponseDto> {
    return this.notificationsService.getNotifications(
      req.user.userId,
      req.user.isDemoUser,
      query,
    );
  }
}
