import { BadRequestException } from '@nestjs/common';
import sharp, { Sharp } from 'sharp';

const MAX_MEDIA_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_PIXELS = 20_000_000;
const MAX_FRAMES = 20;
const DECODE_TIMEOUT_SECONDS = 5;
const DECODE_TIMEOUT_MS = DECODE_TIMEOUT_SECONDS * 1_000;

const FORMAT_TO_CONTENT_TYPE: Record<string, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

type SharpFactory = typeof sharp;

type DecodeDeadline = {
  expired: Promise<never>;
  remainingMs(): number;
  close(): void;
};

export type ValidatedMedia = {
  bytes: Buffer;
  contentType: string;
  width: number;
  height: number;
  frames: number;
};

export class SharpMediaImageProcessor {
  constructor(private readonly sharpFactory: SharpFactory = sharp) {}

  async validateAndReencode(
    input: Buffer,
    declaredContentType: string,
  ): Promise<ValidatedMedia> {
    let image: Sharp | undefined;
    const deadline = this.newDeadline(() => image?.destroy());
    try {
      image = this.sharpFactory(input, {
        animated: true,
        failOn: 'warning',
        limitInputPixels: MAX_TOTAL_PIXELS,
      });
      return await this.decodeAndReencode(image, declaredContentType, deadline);
    } finally {
      deadline.close();
      image?.destroy();
    }
  }

  private async decodeAndReencode(
    image: Sharp,
    declaredContentType: string,
    deadline: DecodeDeadline,
  ): Promise<ValidatedMedia> {
    try {
      // Sharp's native timeout starts only when libvips opens the image, so this
      // deadline also bounds metadata and any wait for a libuv worker.
      const metadata = await this.withDeadline(image.metadata(), deadline);
      const contentType = metadata.format
        ? FORMAT_TO_CONTENT_TYPE[metadata.format]
        : undefined;
      const width = metadata.width ?? 0;
      const frames = metadata.pages ?? 1;
      const height = metadata.pageHeight ?? metadata.height ?? 0;
      if (!contentType || contentType !== declaredContentType) {
        throw new BadRequestException(
          'Media format does not match its declaration',
        );
      }
      if (
        width <= 0 ||
        height <= 0 ||
        frames <= 0 ||
        frames > MAX_FRAMES ||
        width * height * frames > MAX_TOTAL_PIXELS
      ) {
        throw new BadRequestException(
          'Media dimensions exceed the allowed limit',
        );
      }

      const remainingSeconds = Math.floor(deadline.remainingMs() / 1_000);
      if (remainingSeconds < 1) {
        throw new BadRequestException('Media decode timed out');
      }
      // Sharp strips metadata unless withMetadata is called. Do not rotate a
      // multi-frame image, because it can flatten an otherwise valid animation.
      const pipeline = frames === 1 ? image.rotate() : image;
      const output = await this.withDeadline(
        pipeline
          .timeout({ seconds: remainingSeconds })
          .toFormat(metadata.format!)
          .toBuffer({ resolveWithObject: true }),
        deadline,
      );
      if (output.data.length <= 0 || output.data.length > MAX_MEDIA_BYTES) {
        throw new BadRequestException('Validated media is too large');
      }
      return {
        bytes: output.data,
        contentType,
        width: output.info.width,
        height: output.info.pageHeight ?? output.info.height,
        frames: output.info.pages ?? 1,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Media could not be decoded');
    }
  }

  private newDeadline(onTimeout: () => void): DecodeDeadline {
    let timer: NodeJS.Timeout | undefined;
    const startedAt = Date.now();
    const expired = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        onTimeout();
        reject(new BadRequestException('Media decode timed out'));
      }, DECODE_TIMEOUT_MS);
    });
    return {
      expired,
      remainingMs: () =>
        Math.max(0, DECODE_TIMEOUT_MS - (Date.now() - startedAt)),
      close: () => {
        if (timer) {
          clearTimeout(timer);
        }
      },
    };
  }

  private withDeadline<T>(
    operation: Promise<T>,
    deadline: DecodeDeadline,
  ): Promise<T> {
    return Promise.race([operation, deadline.expired]);
  }
}
