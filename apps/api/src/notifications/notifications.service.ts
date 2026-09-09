import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationsQueryDto } from './dto/notifications-query.dto';
import { NotificationsResponseDto } from './dto/notifications-response.dto';
import { NotificationActorDto, NotificationDto } from './dto/notification.dto';
import { User } from '../users/entities/user.entity';
import { ConfigService } from '@nestjs/config';
import { projectMediaUrl } from '../media/media-url';

const DEFAULT_NOTIFICATIONS_LIMIT = 20;

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async getNotifications(
    recipientId: string,
    viewerIsDemo: boolean,
    query: NotificationsQueryDto,
  ): Promise<NotificationsResponseDto> {
    const limit = query.limit ?? DEFAULT_NOTIFICATIONS_LIMIT;

    const qb = this.notificationRepository
      .createQueryBuilder('notification')
      .leftJoinAndSelect('notification.actor', 'actor')
      .leftJoinAndSelect('notification.post', 'post')
      .where('notification.recipientId = :recipientId', { recipientId })
      .andWhere('actor.isDemoUser = :viewerIsDemo', { viewerIsDemo })
      .orderBy('notification.createdAt', 'DESC')
      .addOrderBy('notification.id', 'DESC')
      .take(limit + 1);

    if (query.cursor) {
      const cursor = this.decodeCursor(query.cursor);
      const cursorCreatedAt = this.toCursorCreatedAtParam(cursor.createdAt);
      qb.andWhere(
        '(notification.createdAt < :cursorCreatedAt OR (notification.createdAt = :cursorCreatedAt AND notification.id < :cursorId))',
        { cursorCreatedAt, cursorId: cursor.id },
      );
    }

    const results = await qb.getMany();
    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore
      ? this.encodeCursor(items[items.length - 1])
      : undefined;

    return { items: items.map((n) => this.toNotificationDto(n)), nextCursor };
  }

  private toNotificationDto(notification: Notification): NotificationDto {
    const actor = notification.actor as User | undefined;
    const actorDto: NotificationActorDto = actor
      ? this.toActorDto(actor)
      : {
          id: notification.actorId,
          username: 'unknown',
          fullName: 'Unknown',
        };

    return {
      id: notification.id,
      type: notification.type,
      createdAt: notification.createdAt.toISOString(),
      readAt: notification.readAt
        ? notification.readAt.toISOString()
        : undefined,
      actor: actorDto,
      postId: notification.postId ?? undefined,
      postMediaUrl: projectMediaUrl(
        notification.post?.mediaUrl,
        this.configService.get<string>('S3_PUBLIC_BASE_URL'),
        this.configService.get<string>('S3_DISPLAY_BASE_URL'),
      ),
      commentId: notification.commentId ?? undefined,
    };
  }

  private toActorDto(user: User): NotificationActorDto {
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      profilePictureUrl: projectMediaUrl(
        user.profilePictureUrl,
        this.configService.get<string>('S3_PUBLIC_BASE_URL'),
        this.configService.get<string>('S3_DISPLAY_BASE_URL'),
      ),
    };
  }

  private encodeCursor(entity: { createdAt: Date; id: string }): string {
    return Buffer.from(
      `${entity.createdAt.toISOString()}|${entity.id}`,
    ).toString('base64url');
  }

  private decodeCursor(cursor: string): { createdAt: Date; id: string } {
    let decoded: string;
    try {
      decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    } catch {
      try {
        decoded = Buffer.from(cursor, 'base64').toString('utf8');
      } catch {
        throw new BadRequestException('Invalid cursor');
      }
    }

    const [timestamp, id] = decoded.split('|');
    if (!timestamp || !id) {
      throw new BadRequestException('Invalid cursor');
    }

    const createdAt = new Date(timestamp);
    if (Number.isNaN(createdAt.getTime())) {
      throw new BadRequestException('Invalid cursor');
    }

    return { createdAt, id };
  }

  private toCursorCreatedAtParam(createdAt: Date): Date | string {
    const dbType = this.dataSource?.options?.type;
    if (dbType === 'sqlite' || dbType === 'better-sqlite3') {
      return createdAt.toISOString().slice(0, 19).replace('T', ' ');
    }
    return createdAt;
  }
}
