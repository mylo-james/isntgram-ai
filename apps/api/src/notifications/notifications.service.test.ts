import { BadRequestException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const notification = (id: string, createdAt: string) => ({
    id,
    type: 'like',
    recipientId: 'recipient',
    actorId: 'actor',
    createdAt: new Date(createdAt),
    actor: { id: 'actor', username: 'actor', fullName: 'Actor' },
    postId: null,
    commentId: null,
  });
  const makeService = (items: any[], type = 'sqlite', displayBase?: string) => {
    const qb: any = {
      leftJoinAndSelect: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      orderBy: jest.fn(),
      addOrderBy: jest.fn(),
      take: jest.fn(),
      getMany: jest.fn(),
    };
    for (const method of [
      'leftJoinAndSelect',
      'where',
      'andWhere',
      'orderBy',
      'addOrderBy',
      'take',
    ])
      qb[method].mockReturnValue(qb);
    qb.getMany.mockResolvedValue(items);
    return {
      service: new NotificationsService(
        { createQueryBuilder: jest.fn(() => qb) } as any,
        { options: { type } } as any,
        {
          get: jest.fn((key: string) =>
            key === 'S3_PUBLIC_BASE_URL'
              ? 'http://127.0.0.1:48333/isntgram-v1-media'
              : key === 'S3_DISPLAY_BASE_URL'
                ? displayBase
                : undefined,
          ),
        } as any,
      ),
      qb,
    };
  };
  it('returns a deterministic first page and cursor after trimming the sentinel item', async () => {
    const { service, qb } = makeService([
      notification('z', '2025-01-03'),
      notification('y', '2025-01-02'),
    ]);
    const result = await service.getNotifications('recipient', false, {
      limit: 1,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('z');
    expect(result.nextCursor).toBe(
      Buffer.from('2025-01-03T00:00:00.000Z|z').toString('base64url'),
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      'actor.isDemoUser = :viewerIsDemo',
      { viewerIsDemo: false },
    );
  });
  it('projects a canonical published post URL in a notification DTO without mutating the record', async () => {
    const owner = '550e8400-e29b-41d4-a716-446655440000';
    const object = '660e8400-e29b-41d4-a716-846655440000';
    const source = `http://127.0.0.1:48333/isntgram-v1-media/published/${owner}/${object}`;
    const item = {
      ...notification('z', '2025-01-03'),
      postId: 'post-1',
      post: { mediaUrl: source },
    };
    const { service, qb } = makeService(
      [item],
      'sqlite',
      'https://phone.example:9444/isntgram-v1-media',
    );

    await expect(
      service.getNotifications('recipient', false, {}),
    ).resolves.toMatchObject({
      items: [
        {
          postId: 'post-1',
          postMediaUrl: `https://phone.example:9444/isntgram-v1-media/published/${owner}/${object}`,
        },
      ],
    });
    expect(item.post.mediaUrl).toBe(source);
    expect(qb.getMany).toHaveBeenCalledTimes(1);
  });

  it('projects a canonical actor avatar URL in notification output without mutating the actor', async () => {
    const owner = '550e8400-e29b-41d4-a716-446655440000';
    const object = '660e8400-e29b-41d4-a716-846655440000';
    const canonical = `http://127.0.0.1:48333/isntgram-v1-media/published/${owner}/${object}`;
    const item = {
      ...notification('z', '2025-01-03'),
      actor: {
        id: 'actor',
        username: 'actor',
        fullName: 'Actor',
        profilePictureUrl: canonical,
      },
    };
    const { service } = makeService(
      [item],
      'sqlite',
      'https://phone.example:9444/isntgram-v1-media',
    );

    await expect(
      service.getNotifications('recipient', false, {}),
    ).resolves.toMatchObject({
      items: [
        {
          actor: {
            profilePictureUrl: `https://phone.example:9444/isntgram-v1-media/published/${owner}/${object}`,
          },
        },
      ],
    });
    expect(item.actor.profilePictureUrl).toBe(canonical);
  });

  it('rejects malformed cursors before querying and adapts valid SQLite cursor timestamps', async () => {
    const { service, qb } = makeService([]);
    await expect(
      service.getNotifications('recipient', false, { cursor: 'bad' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(qb.getMany).not.toHaveBeenCalled();
    const cursor = Buffer.from('2025-01-02T03:04:05.000Z|id').toString(
      'base64url',
    );
    await service.getNotifications('recipient', true, { cursor });
    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('notification.createdAt <'),
      { cursorCreatedAt: '2025-01-02 03:04:05', cursorId: 'id' },
    );
  });
});
