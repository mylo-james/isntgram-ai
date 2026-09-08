import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Post } from '../../posts/entities/post.entity';
import { DATE_TIME_COLUMN_TYPE } from '../../common/column-types';

const MAX_MEDIA_UPLOAD_BYTES = 5 * 1024 * 1024;

@Entity('media_uploads')
@Index(['ownerId'])
@Index(['pendingKey'], { unique: true })
@Index(['postId'], { unique: true })
@Check(
  'CHK_MEDIA_UPLOADS_EXPECTED_BYTES',
  '"expectedBytes" > 0 AND "expectedBytes" <= 5242880',
)
@Check(
  'CHK_MEDIA_UPLOADS_PUBLISHED_BYTES',
  '"publishedBytes" IS NULL OR ("publishedBytes" > 0 AND "publishedBytes" <= 5242880)',
)
export class MediaUpload {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  ownerId!: string;

  @Column({ type: 'varchar', length: 1024 })
  pendingKey!: string;

  @Column({ type: 'integer' })
  expectedBytes!: number;

  @Column({ type: 'varchar', length: 128 })
  expectedContentType!: string;

  @CreateDateColumn({ type: DATE_TIME_COLUMN_TYPE })
  createdAt!: Date;

  @Column({ type: DATE_TIME_COLUMN_TYPE })
  expiresAt!: Date;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  publishedKey?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  publishedChecksum?: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  publishedContentType?: string | null;

  @Column({ type: 'integer', nullable: true })
  publishedBytes?: number | null;

  @Column({ type: 'uuid', nullable: true })
  postId?: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'ownerId' })
  owner!: User;

  @OneToOne(() => Post)
  @JoinColumn({ name: 'postId' })
  post?: Post | null;

  static readonly maxBytes = MAX_MEDIA_UPLOAD_BYTES;
}
