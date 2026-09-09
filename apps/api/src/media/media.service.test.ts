import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { MediaUpload } from './entities/media-upload.entity';
import { SharpMediaImageProcessor } from './media-image';
import { MediaService } from './media.service';
import { AdmissionService } from '../common/admission/admission.service';

const config = {
  S3_BUCKET: 'isntgram-v1-media',
  S3_REGION: 'us-east-1',
  S3_ACCESS_KEY_ID: 'local-test-access',
  S3_SECRET_ACCESS_KEY: 'local-test-secret-never-a-real-credential',
  S3_PUBLIC_BASE_URL: 'http://127.0.0.1:48333/isntgram-v1-media',
  S3_ENDPOINT: 'http://127.0.0.1:48333',
};
const input = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  fileName: 'photo.jpg',
  contentType: 'image/jpeg',
  contentLength: 3,
};

function upload(overrides: Partial<MediaUpload> = {}): MediaUpload {
  return {
    id: '660e8400-e29b-41d4-a716-446655440000',
    ownerId: input.userId,
    pendingKey: `pending/${input.userId}/660e8400-e29b-41d4-a716-446655440000`,
    expectedBytes: 3,
    expectedContentType: 'image/jpeg',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  } as MediaUpload;
}

function repository(found: MediaUpload | null = null) {
  return {
    create: jest.fn((value: unknown) => value as MediaUpload),
    save: jest.fn(async (value: unknown) => value as MediaUpload),
    insert: jest.fn(async (value: unknown) => value as MediaUpload),
    findOne: jest.fn(async () => found),
    update: jest.fn(async () => ({ affected: 1 })),
    manager: { query: jest.fn(async () => undefined) },
  };
}

async function* chunks(...values: Buffer[]): AsyncGenerator<Uint8Array> {
  for (const value of values) {
    yield value;
  }
}

function mockPublicationS3(published: Buffer) {
  const send = jest.spyOn(S3Client.prototype, 'send') as unknown as jest.Mock;
  send.mockImplementation(async (command: unknown) => {
    if (command instanceof HeadObjectCommand) {
      return command.input.Key?.startsWith('pending/')
        ? { ContentLength: 3, ContentType: 'image/jpeg' }
        : { ContentLength: published.length, ContentType: 'image/jpeg' };
    }
    if (command instanceof GetObjectCommand) {
      return command.input.Key?.startsWith('pending/')
        ? {
            ContentLength: 3,
            ContentType: 'image/jpeg',
            Body: chunks(Buffer.from('raw')),
          }
        : {
            ContentLength: published.length,
            ContentType: 'image/jpeg',
            Body: chunks(published),
          };
    }
    if (command instanceof PutObjectCommand) {
      return {};
    }
    throw new Error('unexpected command');
  });
  return send;
}

describe('MediaService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('resolves from a real Nest TestingModule with only its two declared dependencies', async () => {
    const mediaRepository = repository();
    const module = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: ConfigService, useValue: new ConfigService(config) },
        {
          provide: getRepositoryToken(MediaUpload),
          useValue: mediaRepository,
        },
        {
          provide: AdmissionService,
          useValue: {
            reserveUpload: jest.fn(),
            releaseUpload: jest.fn(),
            completeUpload: jest.fn(),
          },
        },
      ],
    }).compile();

    expect(module.get(MediaService)).toBeInstanceOf(MediaService);
    await module.close();
  });

  it('persists a private owned 15-minute intent before returning a signed PUT capability', async () => {
    const mediaRepository = repository();
    const service = new MediaService(
      new ConfigService(config),
      mediaRepository as unknown as Repository<MediaUpload>,
    );

    const result = await service.createUploadUrl(input);
    const signed = new URL(result.uploadUrl);
    expect(mediaRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: result.uploadId,
        ownerId: input.userId,
        pendingKey: `pending/${input.userId}/${result.uploadId}`,
      }),
    );
    expect(result.key).toBe(`pending/${input.userId}/${result.uploadId}`);
    expect(result.publicUrl).toMatch(new RegExp(`/${result.key}$`));
    expect(signed.searchParams.get('X-Amz-Expires')).toBe('900');
    expect(signed.searchParams.get('X-Amz-SignedHeaders')?.split(';')).toEqual(
      expect.arrayContaining(['content-length', 'content-type']),
    );
    expect(result.uploadUrl).not.toContain(config.S3_SECRET_ACCESS_KEY);
  });

  it('uses an external client only to presign while retaining the canonical public locator', async () => {
    const service = new MediaService(
      new ConfigService({
        ...config,
        S3_PRESIGN_ENDPOINT: 'https://phone.example:9444',
        S3_DISPLAY_BASE_URL: 'https://phone.example:9444/isntgram-v1-media',
      }),
      repository() as unknown as Repository<MediaUpload>,
    );
    const result = await service.createUploadUrl(input);
    expect(new URL(result.uploadUrl).origin).toBe('https://phone.example:9444');
    expect(result.publicUrl).toMatch(
      /^http:\/\/127\.0\.0\.1:48333\/isntgram-v1-media\/pending\//,
    );
    expect(
      service.toDisplayUrl(
        `http://127.0.0.1:48333/isntgram-v1-media/published/${input.userId}/660e8400-e29b-41d4-a716-846655440000`,
      ),
    ).toBe(
      `https://phone.example:9444/isntgram-v1-media/published/${input.userId}/660e8400-e29b-41d4-a716-846655440000`,
    );
  });

  it('refuses invalid presign input before creating an intent', async () => {
    const mediaRepository = repository();
    const service = new MediaService(
      new ConfigService(config),
      mediaRepository as unknown as Repository<MediaUpload>,
    );

    await expect(
      service.createUploadUrl({ ...input, contentType: 'image/svg+xml' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createUploadUrl({ ...input, contentLength: 0 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mediaRepository.create).not.toHaveBeenCalled();
  });

  it('refuses absent storage configuration before persisting an intent and uses insert for a valid fixed fixture identity', async () => {
    const unconfiguredRepository = repository();
    const unconfigured = new MediaService(
      new ConfigService({ ...config, S3_BUCKET: '' }),
      unconfiguredRepository as unknown as Repository<MediaUpload>,
    );
    await expect(unconfigured.createUploadUrl(input)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(unconfiguredRepository.create).not.toHaveBeenCalled();

    const fixtureRepository = repository();
    const fixture = new MediaService(
      new ConfigService(config),
      fixtureRepository as unknown as Repository<MediaUpload>,
    );
    const uploadId = '660e8400-e29b-51d4-a716-446655440000';
    const result = await fixture.createFixtureUploadUrl(input, uploadId);
    expect(result.uploadId).toBe(uploadId);
    expect(fixtureRepository.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: uploadId, ownerId: input.userId }),
    );
    expect(fixtureRepository.save).not.toHaveBeenCalled();
  });

  it('finds only an owned upload and permits a bound record lookup for replay handling', async () => {
    const mediaRepository = repository(upload({ postId: 'post-id' }));
    const service = new MediaService(
      new ConfigService(config),
      mediaRepository as unknown as Repository<MediaUpload>,
    );

    await expect(
      service.getOwnedUpload(input.userId, 'upload-id'),
    ).resolves.toEqual(expect.objectContaining({ postId: 'post-id' }));
    expect(mediaRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'upload-id', ownerId: input.userId },
    });
    (mediaRepository.findOne as jest.Mock).mockResolvedValueOnce(null);
    await expect(
      service.getOwnedUpload(input.userId, 'upload-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not read expired or bound intents, and closes a HEAD to GET replacement gap', async () => {
    const send = mockPublicationS3(Buffer.from('validated'));
    const expired = new MediaService(
      new ConfigService(config),
      repository(
        upload({ expiresAt: new Date(Date.now() - 1) }),
      ) as unknown as Repository<MediaUpload>,
    );
    await expect(
      expired.preparePublication(input.userId, 'upload-id'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(send).not.toHaveBeenCalled();

    const bound = new MediaService(
      new ConfigService(config),
      repository(
        upload({ postId: 'post-id' }),
      ) as unknown as Repository<MediaUpload>,
    );
    await expect(
      bound.preparePublication(input.userId, 'upload-id'),
    ).rejects.toBeInstanceOf(ConflictException);

    send.mockResolvedValueOnce({ ContentLength: 3, ContentType: 'image/jpeg' });
    send.mockResolvedValueOnce({ ContentLength: 4, ContentType: 'image/jpeg' });
    const mismatch = new MediaService(
      new ConfigService(config),
      repository(upload()) as unknown as Repository<MediaUpload>,
    );
    await expect(
      mismatch.preparePublication(input.userId, 'upload-id'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('streams the exact declared bytes, validates them, and verifies the immutable copy', async () => {
    const validated = Buffer.from('validated');
    const send = mockPublicationS3(validated);
    const decode = jest
      .spyOn(SharpMediaImageProcessor.prototype, 'validateAndReencode')
      .mockResolvedValue({
        bytes: validated,
        contentType: 'image/jpeg',
        width: 2,
        height: 2,
        frames: 1,
      });
    const destroy = jest
      .spyOn(S3Client.prototype, 'destroy')
      .mockImplementation();
    const mediaRepository = repository(upload());
    const service = new MediaService(
      new ConfigService(config),
      mediaRepository as unknown as Repository<MediaUpload>,
      { isDeploymentMode: jest.fn(() => true) } as unknown as AdmissionService,
    );

    const prepared = await service.preparePublication(
      input.userId,
      'upload-id',
    );

    expect(decode).toHaveBeenCalledWith(Buffer.from('raw'), 'image/jpeg');
    expect(prepared).toEqual(
      expect.objectContaining({
        publishedKey: expect.stringMatching(
          new RegExp(`^published/${input.userId}/`),
        ),
        width: 2,
        height: 2,
        frames: 1,
        checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Key: prepared.publishedKey,
          Body: validated,
          ContentLength: validated.length,
        }),
      }),
      expect.objectContaining({ abortSignal: expect.any(AbortSignal) }),
    );
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('refuses a validated image above the hard byte cap before publishing it', async () => {
    const send = mockPublicationS3(Buffer.from('unused'));
    jest
      .spyOn(SharpMediaImageProcessor.prototype, 'validateAndReencode')
      .mockResolvedValue({
        bytes: Buffer.alloc(5 * 1024 * 1024 + 1),
        contentType: 'image/jpeg',
        width: 1,
        height: 1,
        frames: 1,
      });
    const mediaRepository = repository(upload());
    const service = new MediaService(
      new ConfigService(config),
      mediaRepository as unknown as Repository<MediaUpload>,
      { isDeploymentMode: jest.fn(() => true) } as unknown as AdmissionService,
    );

    await expect(
      service.preparePublication(input.userId, 'upload-id'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      send.mock.calls.some(([command]) => command instanceof PutObjectCommand),
    ).toBe(false);
  });

  it('refuses an observed object whose GET body is unavailable before image processing', async () => {
    const send = jest.spyOn(S3Client.prototype, 'send') as unknown as jest.Mock;
    send.mockImplementation(async (command: unknown) => {
      if (command instanceof HeadObjectCommand) {
        return { ContentLength: 3, ContentType: 'image/jpeg' };
      }
      if (command instanceof GetObjectCommand) {
        return { ContentLength: 3, ContentType: 'image/jpeg' };
      }
      throw new Error('unexpected command');
    });
    const decode = jest.spyOn(
      SharpMediaImageProcessor.prototype,
      'validateAndReencode',
    );
    const service = new MediaService(
      new ConfigService(config),
      repository(upload()) as unknown as Repository<MediaUpload>,
    );

    await expect(
      service.preparePublication(input.userId, 'upload-id'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(decode).not.toHaveBeenCalled();
  });

  it('verifies a complete bound publication and refuses incomplete or checksum-mismatched bindings', async () => {
    const body = Buffer.from('raw');
    const complete = upload({
      postId: 'post-id',
      publishedKey: `published/${input.userId}/660e8400-e29b-41d4-a716-446655440001`,
      publishedChecksum: createHash('sha256').update(body).digest('hex'),
      publishedBytes: body.length,
      publishedContentType: 'image/jpeg',
    });
    const mediaRepository = repository(complete);
    const send = jest.spyOn(S3Client.prototype, 'send') as unknown as jest.Mock;
    send.mockResolvedValueOnce({
      ContentLength: body.length,
      ContentType: 'image/jpeg',
      Body: chunks(body),
    });
    const service = new MediaService(
      new ConfigService(config),
      mediaRepository as unknown as Repository<MediaUpload>,
    );

    await expect(
      service.verifyBoundPublication(input.userId, 'upload-id'),
    ).resolves.toMatchObject({
      postId: 'post-id',
      key: complete.publishedKey,
      checksum: complete.publishedChecksum,
      bytes: body.length,
    });

    (mediaRepository.findOne as jest.Mock).mockResolvedValueOnce(
      upload({ postId: 'post-id' }),
    );
    await expect(
      service.verifyBoundPublication(input.userId, 'upload-id'),
    ).rejects.toBeInstanceOf(BadRequestException);

    (mediaRepository.findOne as jest.Mock).mockResolvedValueOnce({
      ...complete,
      publishedChecksum: '00'.repeat(32),
    });
    send.mockResolvedValueOnce({
      ContentLength: body.length,
      ContentType: 'image/jpeg',
      Body: chunks(body),
    });
    await expect(
      service.verifyBoundPublication(input.userId, 'upload-id'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('records a verification orphan when a published HEAD reports wrong immutable metadata', async () => {
    const validated = Buffer.from('valid');
    const send = jest.spyOn(S3Client.prototype, 'send') as unknown as jest.Mock;
    send.mockImplementation(async (command: unknown) => {
      if (command instanceof HeadObjectCommand) {
        return command.input.Key?.startsWith('pending/')
          ? { ContentLength: 3, ContentType: 'image/jpeg' }
          : { ContentLength: validated.length - 1, ContentType: 'image/jpeg' };
      }
      if (command instanceof GetObjectCommand) {
        return {
          ContentLength: 3,
          ContentType: 'image/jpeg',
          Body: chunks(Buffer.from('raw')),
        };
      }
      if (command instanceof PutObjectCommand) return {};
      throw new Error('unexpected command');
    });
    jest
      .spyOn(SharpMediaImageProcessor.prototype, 'validateAndReencode')
      .mockResolvedValue({
        bytes: validated,
        contentType: 'image/jpeg',
        width: 1,
        height: 1,
        frames: 1,
      });
    const logger = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const service = new MediaService(
      new ConfigService(config),
      repository(upload()) as unknown as Repository<MediaUpload>,
    );

    await expect(
      service.preparePublication(input.userId, 'upload-id'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(logger).toHaveBeenCalledWith(
      expect.stringContaining('publication_verification_failed'),
    );
  });

  it('aborts an oversized stream and records only a bounded publication uncertainty', async () => {
    const send = mockPublicationS3(Buffer.from('validated'));
    send.mockResolvedValueOnce({ ContentLength: 3, ContentType: 'image/jpeg' });
    send.mockResolvedValueOnce({
      ContentLength: 3,
      ContentType: 'image/jpeg',
      Body: chunks(Buffer.from('four')),
    });
    const mediaRepository = repository(upload());
    const service = new MediaService(
      new ConfigService(config),
      mediaRepository as unknown as Repository<MediaUpload>,
      { isDeploymentMode: jest.fn(() => true) } as unknown as AdmissionService,
    );
    await expect(
      service.preparePublication(input.userId, 'upload-id'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(send).toHaveBeenCalledTimes(2);

    const logger = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const record = await service.recordOrphan(
      {
        uploadId: 'upload-id',
        ownerId: input.userId,
        publishedKey: 'published/owner/object',
        publishedUrl: 'https://storage.example/ignored?token=never-logged',
        checksum: 'checksum',
        contentType: 'image/jpeg',
        bytes: 1,
        width: 1,
        height: 1,
        frames: 1,
      },
      'db_binding_failed',
    );
    expect(record).toEqual({
      uploadId: 'upload-id',
      ownerId: input.userId,
      publishedKey: 'published/owner/object',
      reason: 'db_binding_failed',
    });
    expect(logger).toHaveBeenCalledWith(JSON.stringify(record));
    expect(mediaRepository.manager.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO media_deletion_intents'),
      [
        'test',
        'upload-id',
        'published/owner/object',
        'db_binding_failed',
      ],
    );
  });

  it('uses one absolute five-second deadline while waiting for pending GET headers', async () => {
    jest.useFakeTimers();
    try {
      let getSignal: AbortSignal | undefined;
      const send = jest.spyOn(
        S3Client.prototype,
        'send',
      ) as unknown as jest.Mock;
      send.mockImplementation(
        async (command: unknown, options?: { abortSignal?: AbortSignal }) => {
          if (command instanceof HeadObjectCommand) {
            return { ContentLength: 3, ContentType: 'image/jpeg' };
          }
          if (command instanceof GetObjectCommand) {
            getSignal = options?.abortSignal;
            return new Promise(() => {});
          }
          throw new Error('unexpected command');
        },
      );
      const service = new MediaService(
        new ConfigService(config),
        repository(upload()) as unknown as Repository<MediaUpload>,
      );

      const publication = service.preparePublication(input.userId, 'upload-id');
      const rejection =
        expect(publication).rejects.toBeInstanceOf(BadRequestException);
      await jest.advanceTimersByTimeAsync(5_000);
      await rejection;
      expect(getSignal?.aborted).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not reset the deadline for a slow pending stream and destroys it on timeout', async () => {
    jest.useFakeTimers();
    try {
      const slowBody = Readable.from(
        (async function* () {
          yield Buffer.from('r');
          await new Promise((resolve) => setTimeout(resolve, 5_001));
          yield Buffer.from('aw');
        })(),
      );
      const destroy = jest.spyOn(slowBody, 'destroy');
      const send = jest.spyOn(
        S3Client.prototype,
        'send',
      ) as unknown as jest.Mock;
      send.mockImplementation(async (command: unknown) => {
        if (command instanceof HeadObjectCommand) {
          return { ContentLength: 3, ContentType: 'image/jpeg' };
        }
        if (command instanceof GetObjectCommand) {
          return {
            ContentLength: 3,
            ContentType: 'image/jpeg',
            Body: slowBody,
          };
        }
        throw new Error('unexpected command');
      });
      const service = new MediaService(
        new ConfigService(config),
        repository(upload()) as unknown as Repository<MediaUpload>,
      );

      const publication = service.preparePublication(input.userId, 'upload-id');
      const rejection =
        expect(publication).rejects.toBeInstanceOf(BadRequestException);
      await jest.advanceTimersByTimeAsync(5_000);
      await rejection;
      expect(destroy).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('applies the same absolute deadline and stream destruction to published GET verification', async () => {
    jest.useFakeTimers();
    try {
      const slowBody = Readable.from(
        (async function* () {
          yield Buffer.from('v');
          await new Promise((resolve) => setTimeout(resolve, 5_001));
          yield Buffer.from('alidated');
        })(),
      );
      const destroy = jest.spyOn(slowBody, 'destroy');
      const send = jest.spyOn(
        S3Client.prototype,
        'send',
      ) as unknown as jest.Mock;
      send.mockImplementation(async (command: unknown) => {
        if (command instanceof HeadObjectCommand) {
          return command.input.Key?.startsWith('pending/')
            ? { ContentLength: 3, ContentType: 'image/jpeg' }
            : { ContentLength: 9, ContentType: 'image/jpeg' };
        }
        if (command instanceof GetObjectCommand) {
          return command.input.Key?.startsWith('pending/')
            ? {
                ContentLength: 3,
                ContentType: 'image/jpeg',
                Body: Readable.from([Buffer.from('raw')]),
              }
            : {
                ContentLength: 9,
                ContentType: 'image/jpeg',
                Body: slowBody,
              };
        }
        if (command instanceof PutObjectCommand) {
          return {};
        }
        throw new Error('unexpected command');
      });
      jest
        .spyOn(SharpMediaImageProcessor.prototype, 'validateAndReencode')
        .mockResolvedValue({
          bytes: Buffer.from('validated'),
          contentType: 'image/jpeg',
          width: 1,
          height: 1,
          frames: 1,
        });
      const service = new MediaService(
        new ConfigService(config),
        repository(upload()) as unknown as Repository<MediaUpload>,
      );

      const publication = service.preparePublication(input.userId, 'upload-id');
      const rejection =
        expect(publication).rejects.toBeInstanceOf(BadRequestException);
      await jest.advanceTimersByTimeAsync(5_000);
      await rejection;
      expect(destroy).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('retains a safe audit record when server publication verification fails', async () => {
    mockPublicationS3(Buffer.from('different'));
    jest
      .spyOn(SharpMediaImageProcessor.prototype, 'validateAndReencode')
      .mockResolvedValue({
        bytes: Buffer.from('validated'),
        contentType: 'image/jpeg',
        width: 1,
        height: 1,
        frames: 1,
      });
    const logger = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const service = new MediaService(
      new ConfigService(config),
      repository(upload()) as unknown as Repository<MediaUpload>,
    );

    await expect(
      service.preparePublication(input.userId, 'upload-id'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(logger).toHaveBeenCalledWith(
      expect.stringContaining('publication_verification_failed'),
    );
    expect(logger.mock.calls[0][0]).not.toContain('https://');
  });
});
