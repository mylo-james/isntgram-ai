import { NotificationsWriter } from './notifications.writer';
import { Notification } from './entities/notification.entity';

describe('NotificationsWriter', () => {
  const makeManager = () => {
    const repository = {
      create: jest.fn((value) => value),
      save: jest.fn(),
    };
    const manager = {
      getRepository: jest.fn(() => repository),
    };
    return { manager, repository };
  };

  it('persists an action-scoped notification through the caller manager', async () => {
    const { manager, repository } = makeManager();
    const writer = new NotificationsWriter();
    const notification = {
      recipientId: 'recipient-id',
      actorId: 'actor-id',
      type: 'like' as const,
      sourceId: 'like-action-id',
      postId: 'post-id',
    };

    await writer.write(manager as any, notification);

    expect(manager.getRepository).toHaveBeenCalledWith(Notification);
    expect(repository.create).toHaveBeenCalledWith(notification);
    expect(repository.save).toHaveBeenCalledWith(notification);
  });

  it('does not create a self-notification', async () => {
    const { manager } = makeManager();
    const writer = new NotificationsWriter();

    await writer.write(manager as any, {
      recipientId: 'user-id',
      actorId: 'user-id',
      type: 'comment',
      sourceId: 'comment-action-id',
      postId: 'post-id',
      commentId: 'comment-id',
    });

    expect(manager.getRepository).not.toHaveBeenCalled();
  });

  it('propagates a persistence failure to the owning transaction', async () => {
    const { manager, repository } = makeManager();
    const writer = new NotificationsWriter();
    const error = new Error('notification insert failed');
    repository.save.mockRejectedValueOnce(error);

    await expect(
      writer.write(manager as any, {
        recipientId: 'recipient-id',
        actorId: 'actor-id',
        type: 'follow',
        sourceId: 'follow-action-id',
      }),
    ).rejects.toThrow(error);
  });
});
