import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { SharpMediaImageProcessor } from './media-image';

async function animatedGif(frameCount: number): Promise<Buffer> {
  const frames = await Promise.all(
    Array.from({ length: frameCount }, (_, index) => index).map((index) =>
      sharp({
        create: {
          width: 2,
          height: 2,
          channels: 3,
          background: { r: index * 10, g: 0, b: 255 - index * 10 },
        },
      })
        .png()
        .toBuffer(),
    ),
  );
  return sharp(frames, { join: { animated: true } })
    .gif({ delay: Array(frameCount).fill(100) })
    .toBuffer();
}

describe('SharpMediaImageProcessor', () => {
  const processor = new SharpMediaImageProcessor();

  it('rejects corrupt bytes and a declaration that does not match the decoded format', async () => {
    await expect(
      processor.validateAndReencode(Buffer.from('not-an-image'), 'image/jpeg'),
    ).rejects.toBeInstanceOf(BadRequestException);

    const png = await sharp({
      create: {
        width: 2,
        height: 2,
        channels: 3,
        background: { r: 10, g: 20, b: 30 },
      },
    })
      .png()
      .toBuffer();
    await expect(
      processor.validateAndReencode(png, 'image/jpeg'),
    ).rejects.toBeInstanceOf(BadRequestException);

    const webp = await sharp(png).webp().toBuffer();
    await expect(
      processor.validateAndReencode(webp, 'image/webp'),
    ).resolves.toEqual(expect.objectContaining({ contentType: 'image/webp' }));
  });

  it('uses the actual decoder pixel limit before accepting a compact oversized raster', async () => {
    const oversized = await sharp({
      create: {
        width: 5_000,
        height: 4_001,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    await expect(
      processor.validateAndReencode(oversized, 'image/png'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts the 20-megapixel boundary and rejects a real 21-frame animation', async () => {
    const boundary = await sharp({
      create: {
        width: 4_000,
        height: 5_000,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();
    await expect(
      processor.validateAndReencode(boundary, 'image/png'),
    ).resolves.toEqual(
      expect.objectContaining({ width: 4_000, height: 5_000, frames: 1 }),
    );
    await expect(
      processor.validateAndReencode(await animatedGif(21), 'image/gif'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('preserves supported animation while stripping input EXIF metadata on re-encode', async () => {
    const animation = await processor.validateAndReencode(
      await animatedGif(2),
      'image/gif',
    );
    expect(animation.contentType).toBe('image/gif');
    expect(animation).toEqual(
      expect.objectContaining({ width: 2, height: 2, frames: 2 }),
    );
    expect(
      (await sharp(animation.bytes, { animated: true }).metadata()).pages,
    ).toBe(2);

    const jpegWithExif = await sharp({
      create: {
        width: 2,
        height: 2,
        channels: 3,
        background: { r: 10, g: 20, b: 30 },
      },
    })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Artist: 'private-author' } } })
      .toBuffer();
    const reencoded = await processor.validateAndReencode(
      jpegWithExif,
      'image/jpeg',
    );
    expect((await sharp(reencoded.bytes).metadata()).exif).toBeUndefined();

    const oriented = await sharp({
      create: {
        width: 3,
        height: 2,
        channels: 3,
        background: { r: 10, g: 20, b: 30 },
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    await expect(
      processor.validateAndReencode(oriented, 'image/jpeg'),
    ).resolves.toEqual(expect.objectContaining({ width: 2, height: 3 }));
  });

  it('stops after stalled metadata and never starts a later output operation', async () => {
    jest.useFakeTimers();
    try {
      let resolveMetadata: ((value: object) => void) | undefined;
      const metadata = jest.fn(
        () =>
          new Promise<object>((resolve) => {
            resolveMetadata = resolve;
          }),
      );
      const toBuffer = jest.fn();
      const image = {
        metadata,
        rotate: jest.fn(),
        timeout: jest.fn(),
        toFormat: jest.fn(),
        toBuffer,
        destroy: jest.fn(),
      };
      image.rotate.mockReturnValue(image);
      image.timeout.mockReturnValue(image);
      image.toFormat.mockReturnValue(image);
      const factory = jest.fn(() => image);
      const stalled = new SharpMediaImageProcessor(
        factory as unknown as typeof sharp,
      );

      const decoding = stalled.validateAndReencode(
        Buffer.from('input'),
        'image/jpeg',
      );
      const rejection =
        expect(decoding).rejects.toBeInstanceOf(BadRequestException);
      await jest.advanceTimersByTimeAsync(5_000);
      await rejection;
      resolveMetadata?.({ format: 'jpeg', width: 1, height: 1 });
      await Promise.resolve();
      expect(toBuffer).not.toHaveBeenCalled();
      expect(image.destroy).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
