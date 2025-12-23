import { BadRequestException } from '@nestjs/common';
import { PostsService } from './posts.service';

describe('PostsService cursor helpers', () => {
  const service = new PostsService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  ) as any;

  it('encodes and decodes a cursor round-trip', () => {
    const post = {
      id: 'post-1',
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
    };
    const encoded = service.encodeCursor(post);
    const decoded = service.decodeCursor(encoded);

    expect(decoded.id).toBe('post-1');
    expect(decoded.createdAt.toISOString()).toBe('2025-01-01T00:00:00.000Z');
  });

  it('throws on invalid base64 cursor', () => {
    expect(() => service.decodeCursor('not-base64!!')).toThrow(
      BadRequestException,
    );
  });

  it('throws when cursor is missing fields', () => {
    const missingId = Buffer.from('2025-01-01T00:00:00.000Z|').toString(
      'base64',
    );
    expect(() => service.decodeCursor(missingId)).toThrow(BadRequestException);
  });

  it('throws when cursor timestamp is invalid', () => {
    const invalidDate = Buffer.from('not-a-date|post-1').toString('base64');
    expect(() => service.decodeCursor(invalidDate)).toThrow(
      BadRequestException,
    );
  });
});
