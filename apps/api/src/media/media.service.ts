import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import path from 'path';

const DEFAULT_EXPIRES_IN = 900; // 15 minutes
const DEFAULT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

@Injectable()
export class MediaService {
  private readonly bucket: string;
  private readonly region: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly publicBaseUrl: string;
  private readonly endpoint?: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('S3_BUCKET') || '';
    this.region = this.configService.get<string>('S3_REGION') || '';
    this.accessKeyId = this.configService.get<string>('S3_ACCESS_KEY_ID') || '';
    this.secretAccessKey =
      this.configService.get<string>('S3_SECRET_ACCESS_KEY') || '';
    this.publicBaseUrl =
      this.configService.get<string>('S3_PUBLIC_BASE_URL') || '';
    this.endpoint = this.configService.get<string>('S3_ENDPOINT') || undefined;
  }

  async createUploadUrl(params: {
    userId: string;
    fileName: string;
    contentType: string;
    contentLength: number;
  }): Promise<{
    uploadUrl: string;
    publicUrl: string;
    key: string;
    expiresIn: number;
  }> {
    if (
      !this.bucket ||
      !this.region ||
      !this.accessKeyId ||
      !this.secretAccessKey ||
      !this.publicBaseUrl
    ) {
      throw new InternalServerErrorException('Media storage is not configured');
    }

    if (!ALLOWED_CONTENT_TYPES.has(params.contentType)) {
      throw new BadRequestException('Unsupported media type');
    }

    const maxBytesRaw = this.configService.get<string>(
      'MEDIA_MAX_UPLOAD_BYTES',
    );
    const maxBytes = Number(maxBytesRaw ?? DEFAULT_MAX_UPLOAD_BYTES);
    if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
      throw new InternalServerErrorException('Invalid media upload limit');
    }

    if (params.contentLength > maxBytes) {
      throw new BadRequestException('File too large');
    }

    const key = this.buildObjectKey(params.userId, params.fileName);
    const client = this.createClient();
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: params.contentType,
      ContentLength: params.contentLength,
    });

    const uploadUrl = await getSignedUrl(client, command, {
      expiresIn: DEFAULT_EXPIRES_IN,
    });

    const publicUrl = `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`;

    return {
      uploadUrl,
      publicUrl,
      key,
      expiresIn: DEFAULT_EXPIRES_IN,
    };
  }

  private buildObjectKey(userId: string, fileName: string): string {
    const ext = path.extname(fileName).slice(0, 10);
    const safeBase = fileName
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9-_\.]/g, '')
      .toLowerCase();
    const sanitized = safeBase.length ? safeBase : `upload${ext}`;
    return `uploads/${userId}/${Date.now()}-${randomUUID()}-${sanitized}`;
  }

  private createClient(): S3Client {
    return new S3Client({
      region: this.region,
      endpoint: this.endpoint,
      forcePathStyle: Boolean(this.endpoint),
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });
  }
}
