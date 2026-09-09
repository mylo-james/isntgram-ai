import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';

export type NotificationWrite = {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  sourceId: string;
  postId?: string | null;
  commentId?: string | null;
};

@Injectable()
export class NotificationsWriter {
  async write(
    manager: EntityManager,
    notification: NotificationWrite,
  ): Promise<void> {
    if (notification.actorId === notification.recipientId) return;

    const repository = manager.getRepository(Notification);
    await repository.save(repository.create(notification));
  }
}
