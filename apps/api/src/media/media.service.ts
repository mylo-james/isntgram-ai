import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash, randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { SharpMediaImageProcessor } from './media-image';
import { MediaUpload } from './entities/media-upload.entity';
import { projectMediaUrl } from './media-url';

const DEFAULT_EXPIRES_IN = 900;
const DEFAULT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 5_000;
const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const ORPHAN_REASONS = new Set([
  'publication_write_uncertain',
  'publication_verification_failed',
  'db_binding_failed',
  'post_transaction_failed',
  'profile_transaction_failed',
]);

type OrphanReason =
  | 'publication_write_uncertain'
  | 'publication_verification_failed'
  | 'db_binding_failed'
  | 'post_transaction_failed'
  | 'profile_transaction_failed';

export type PreparedMedia = {
  uploadId: string;
  ownerId: string;
  publishedKey: string;
  publishedUrl: string;
  checksum: string;
  contentType: string;
  bytes: number;
  width: number;
  height: number;
  frames: number;
};

type ObjectBody = AsyncIterable<Uint8Array>;
type UploadRequest = {
  userId: string;
  fileName: string;
  contentType: string;
  contentLength: number;
};

type ReadDeadline = {
  controller: AbortController;
  expired: Promise<never>;
  close(): void;
};

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly imageProcessor = new SharpMediaImageProcessor();
  private readonly bucket: string;
  private readonly region: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly publicBaseUrl: string;
  private readonly endpoint?: string;
  private readonly presignEndpoint?: string;
  private readonly displayBaseUrl?: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(MediaUpload)
    private readonly mediaUploadRepository: Repository<MediaUpload>,
  ) {
    this.bucket = this.configService.get<string>('S3_BUCKET') || '';
    this.region = this.configService.get<string>('S3_REGION') || '';
    this.accessKeyId = this.configService.get<string>('S3_ACCESS_KEY_ID') || '';
    this.secretAccessKey =
      this.configService.get<string>('S3_SECRET_ACCESS_KEY') || '';
    this.publicBaseUrl =
      this.configService.get<string>('S3_PUBLIC_BASE_URL') || '';
    this.endpoint = this.configService.get<string>('S3_ENDPOINT') || undefined;
    this.presignEndpoint =
      this.configService.get<string>('S3_PRESIGN_ENDPOINT') || undefined;
    this.displayBaseUrl =
      this.configService.get<string>('S3_DISPLAY_BASE_URL') || undefined;
  }

  async createUploadUrl(params: UploadRequest) {
    return this.createUploadIntent(params, randomUUID());
  }

  // Fixed identities are available only to the guarded local fixture command.
  async createFixtureUploadUrl(params: UploadRequest, uploadId: string) {
    if (
      !/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
        uploadId,
      )
    )
      throw new BadRequestException('Invalid fixture upload identity');
    return this.createUploadIntent(params, uploadId, true);
  }

  private async createUploadIntent(
    params: UploadRequest,
    uploadId: string,
    fixed = false,
  ): Promise<{
    uploadId: string;
    uploadUrl: string;
    publicUrl: string;
    key: string;
    expiresIn: number;
  }> {
    this.assertStorageConfigured();
    this.assertUploadRequest(params.contentType, params.contentLength);

    const key = `pending/${params.userId}/${uploadId}`;
    const intent = this.mediaUploadRepository.create({
      id: uploadId,
      ownerId: params.userId,
      pendingKey: key,
      expectedBytes: params.contentLength,
      expectedContentType: params.contentType,
      expiresAt: new Date(Date.now() + DEFAULT_EXPIRES_IN * 1_000),
    });
    // The intent exists before the browser receives a write capability. `publicUrl`
    // remains a compatibility locator for old clients. Pending keys stay private and
    // are never authority to attach media to a post.
    if (fixed) await this.mediaUploadRepository.insert(intent);
    else await this.mediaUploadRepository.save(intent);

    const client = this.createPresigningClient();
    try {
      const uploadUrl = await getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          ContentType: params.contentType,
          ContentLength: params.contentLength,
        }),
        {
          expiresIn: DEFAULT_EXPIRES_IN,
          signableHeaders: new Set(['content-type', 'content-length']),
        },
      );
      return {
        uploadId,
        uploadUrl,
        publicUrl: this.toPublicUrl(key),
        key,
        expiresIn: DEFAULT_EXPIRES_IN,
      };
    } finally {
      client.destroy();
    }
  }

  async getOwnedUpload(userId: string, uploadId: string): Promise<MediaUpload> {
    const upload = await this.mediaUploadRepository.findOne({
      where: { id: uploadId, ownerId: userId },
    });
    if (!upload) {
      throw new NotFoundException('Media upload was not found');
    }
    return upload;
  }

  async preparePublication(
    userId: string,
    uploadId: string,
  ): Promise<PreparedMedia> {
    this.assertStorageConfigured();
    const upload = await this.getOwnedUpload(userId, uploadId);
    if (upload.postId || upload.profilePictureUserId) {
      throw new ConflictException('Media upload is already in use');
    }
    if (upload.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Media upload intent has expired');
    }
    this.assertUploadRequest(upload.expectedContentType, upload.expectedBytes);

    const client = this.createClient();
    try {
      const head = await client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: upload.pendingKey }),
        { abortSignal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
      );
      this.assertObservedObject(upload, head.ContentLength, head.ContentType);
      const input = await this.getExactObject(
        client,
        upload.pendingKey,
        upload.expectedBytes,
        upload.expectedContentType,
      );
      const validated = await this.imageProcessor.validateAndReencode(
        input,
        upload.expectedContentType,
      );
      if (validated.bytes.length > DEFAULT_MAX_UPLOAD_BYTES) {
        throw new BadRequestException('Validated media is too large');
      }

      const checksum = createHash('sha256')
        .update(validated.bytes)
        .digest('hex');
      const prepared: PreparedMedia = {
        uploadId: upload.id,
        ownerId: upload.ownerId,
        publishedKey: `published/${userId}/${randomUUID()}`,
        publishedUrl: '',
        checksum,
        contentType: validated.contentType,
        bytes: validated.bytes.length,
        width: validated.width,
        height: validated.height,
        frames: validated.frames,
      };
      prepared.publishedUrl = this.toPublicUrl(prepared.publishedKey);

      let writeCompleted = false;
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: prepared.publishedKey,
            Body: validated.bytes,
            ContentType: prepared.contentType,
            ContentLength: prepared.bytes,
            ChecksumSHA256: Buffer.from(checksum, 'hex').toString('base64'),
          }),
          { abortSignal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
        );
        writeCompleted = true;
        await this.verifyPublishedObject(client, prepared, validated.bytes);
      } catch (error) {
        this.recordOrphan(
          prepared,
          writeCompleted
            ? 'publication_verification_failed'
            : 'publication_write_uncertain',
        );
        throw error;
      }
      return prepared;
    } finally {
      client.destroy();
    }
  }

  getPublishedUrl(upload: MediaUpload): string | undefined {
    if (
      !upload.publishedKey ||
      !upload.publishedKey.startsWith(`published/${upload.ownerId}/`)
    ) {
      return undefined;
    }
    return this.toPublicUrl(upload.publishedKey);
  }

  async verifyBoundPublication(userId: string, uploadId: string) {
    this.assertStorageConfigured();
    const upload = await this.getOwnedUpload(userId, uploadId);
    if (
      !upload.postId ||
      !upload.publishedKey ||
      !upload.publishedKey.startsWith(`published/${userId}/`) ||
      !/^[a-f0-9]{64}$/.test(upload.publishedChecksum ?? '') ||
      !upload.publishedBytes ||
      !upload.publishedContentType
    )
      throw new BadRequestException('Published media binding is incomplete');
    this.assertUploadRequest(
      upload.publishedContentType,
      upload.publishedBytes,
    );
    const client = this.createClient();
    try {
      const body = await this.getExactObject(
        client,
        upload.publishedKey,
        upload.publishedBytes,
        upload.publishedContentType,
      );
      const checksum = createHash('sha256').update(body).digest('hex');
      if (checksum !== upload.publishedChecksum)
        throw new BadRequestException('Published media checksum differs');
      return {
        postId: upload.postId,
        uploadId,
        ownerId: userId,
        key: upload.publishedKey,
        url: this.toPublicUrl(upload.publishedKey),
        checksum,
        bytes: body.length,
        contentType: upload.publishedContentType,
      };
    } finally {
      client.destroy();
    }
  }

  recordOrphan(
    prepared: PreparedMedia,
    reason: OrphanReason,
  ): {
    uploadId: string;
    ownerId: string;
    publishedKey: string;
    reason: OrphanReason;
  } {
    const safeReason: OrphanReason = ORPHAN_REASONS.has(reason)
      ? reason
      : 'db_binding_failed';
    const record = {
      uploadId: prepared.uploadId,
      ownerId: prepared.ownerId,
      publishedKey: prepared.publishedKey,
      reason: safeReason,
    };
    this.logger.warn(JSON.stringify(record));
    return record;
  }

  private async verifyPublishedObject(
    client: S3Client,
    prepared: PreparedMedia,
    expected: Buffer,
  ): Promise<void> {
    const head = await client.send(
      new HeadObjectCommand({
        Bucket: this.bucket,
        Key: prepared.publishedKey,
      }),
      { abortSignal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );
    if (
      head.ContentLength !== prepared.bytes ||
      head.ContentType !== prepared.contentType
    ) {
      throw new InternalServerErrorException(
        'Published media verification failed',
      );
    }
    const bytes = await this.getExactObject(
      client,
      prepared.publishedKey,
      prepared.bytes,
      prepared.contentType,
    );
    if (!bytes.equals(expected)) {
      throw new InternalServerErrorException(
        'Published media verification failed',
      );
    }
  }

  private assertStorageConfigured(): void {
    if (
      !this.bucket ||
      !this.region ||
      !this.accessKeyId ||
      !this.secretAccessKey ||
      !this.publicBaseUrl
    ) {
      throw new InternalServerErrorException('Media storage is not configured');
    }
  }

  private assertUploadRequest(
    contentType: string,
    contentLength: number,
  ): void {
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      throw new BadRequestException('Unsupported media type');
    }
    const configuredMaxBytes = Number(
      this.configService.get<string>('MEDIA_MAX_UPLOAD_BYTES') ??
        DEFAULT_MAX_UPLOAD_BYTES,
    );
    if (!Number.isFinite(configuredMaxBytes) || configuredMaxBytes <= 0) {
      throw new InternalServerErrorException('Invalid media upload limit');
    }
    const maxBytes = Math.min(configuredMaxBytes, DEFAULT_MAX_UPLOAD_BYTES);
    if (
      !Number.isSafeInteger(contentLength) ||
      contentLength <= 0 ||
      contentLength > maxBytes
    ) {
      throw new BadRequestException('File is too large');
    }
  }

  private assertObservedObject(
    upload: MediaUpload,
    contentLength?: number,
    contentType?: string,
  ): void {
    if (
      contentLength !== upload.expectedBytes ||
      contentLength <= 0 ||
      contentLength > DEFAULT_MAX_UPLOAD_BYTES ||
      contentType !== upload.expectedContentType
    ) {
      throw new BadRequestException('Uploaded media does not match its intent');
    }
  }

  private async getExactObject(
    client: S3Client,
    key: string,
    expectedBytes: number,
    expectedContentType: string,
  ): Promise<Buffer> {
    const deadline = this.newReadDeadline();
    let body: unknown;
    try {
      const request = client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
        { abortSignal: deadline.controller.signal },
      );
      // A real SDK request observes abort. This handler also releases a body if a
      // non-cooperative transport resolves after our absolute deadline.
      void request
        .then((lateObject) => {
          if (deadline.controller.signal.aborted) {
            this.destroyBody(lateObject.Body);
          }
        })
        .catch(() => undefined);
      const object = await this.withDeadline(request, deadline);
      body = object.Body;
      if (
        object.ContentLength !== expectedBytes ||
        object.ContentType !== expectedContentType
      ) {
        throw new BadRequestException(
          'Media object does not match its upload intent',
        );
      }
      return await this.readBoundedBody(body, expectedBytes, deadline);
    } finally {
      deadline.controller.abort();
      this.destroyBody(body);
      deadline.close();
    }
  }

  private async readBoundedBody(
    body: unknown,
    expectedBytes: number,
    deadline: ReadDeadline,
  ): Promise<Buffer> {
    if (!this.isAsyncIterable(body)) {
      deadline.controller.abort();
      throw new BadRequestException('Media object body is unavailable');
    }
    const chunks: Buffer[] = [];
    let bytesRead = 0;
    const iterator = body[Symbol.asyncIterator]();
    try {
      while (true) {
        const next = await this.withDeadline(iterator.next(), deadline);
        if (next.done) {
          break;
        }
        const chunk = Buffer.from(next.value);
        bytesRead += chunk.length;
        if (bytesRead > expectedBytes || bytesRead > DEFAULT_MAX_UPLOAD_BYTES) {
          deadline.controller.abort();
          throw new BadRequestException(
            'Media object exceeds its upload intent',
          );
        }
        chunks.push(chunk);
      }
    } finally {
      if (bytesRead !== expectedBytes) {
        deadline.controller.abort();
      }
    }
    if (bytesRead !== expectedBytes || bytesRead <= 0) {
      throw new BadRequestException(
        'Media object does not match its upload intent',
      );
    }
    return Buffer.concat(chunks, bytesRead);
  }

  private newReadDeadline(): ReadDeadline {
    const controller = new AbortController();
    let timer: NodeJS.Timeout | undefined;
    const expired = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new BadRequestException('Media object read timed out'));
      }, FETCH_TIMEOUT_MS);
    });
    return {
      controller,
      expired,
      close: () => {
        if (timer) {
          clearTimeout(timer);
        }
      },
    };
  }

  private async withDeadline<T>(
    operation: Promise<T>,
    deadline: ReadDeadline,
  ): Promise<T> {
    return Promise.race([operation, deadline.expired]);
  }

  private isAsyncIterable(body: unknown): body is ObjectBody {
    return (
      typeof body === 'object' &&
      body !== null &&
      Symbol.asyncIterator in body &&
      typeof body[Symbol.asyncIterator] === 'function'
    );
  }

  private destroyBody(body: unknown): void {
    if (
      typeof body === 'object' &&
      body !== null &&
      'destroy' in body &&
      typeof body.destroy === 'function'
    ) {
      body.destroy();
    }
  }

  private toPublicUrl(key: string): string {
    return `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`;
  }

  toDisplayUrl(value: string | undefined): string | undefined {
    return projectMediaUrl(value, this.publicBaseUrl, this.displayBaseUrl);
  }

  private createPresigningClient(): S3Client {
    return this.createClient(this.presignEndpoint ?? this.endpoint);
  }

  private createClient(endpoint = this.endpoint): S3Client {
    return new S3Client({
      region: this.region,
      endpoint,
      forcePathStyle: Boolean(endpoint),
      maxAttempts: 1,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });
  }
}
