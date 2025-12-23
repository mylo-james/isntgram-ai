import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationDto } from './notification.dto';

export class NotificationsResponseDto {
  @ApiProperty({ type: [NotificationDto] })
  items!: NotificationDto[];

  @ApiPropertyOptional({
    description: 'Opaque cursor for pagination',
    example:
      'MjAyNS0xMi0xOVQxMDoxMjowMC4wMDBafDY2ZWZiNjRjLTcwMmYtNDZmNS05YjQ0LTdjOWYyYjBhMGQ2MQ==',
  })
  nextCursor?: string;
}
