import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Post } from '../../posts/entities/post.entity';
import { Comment } from '../../posts/entities/comment.entity';
import { DATE_TIME_COLUMN_TYPE } from '../../common/column-types';

export type NotificationType = 'follow' | 'like' | 'comment';

@Entity('notifications')
@Index(['recipientId', 'createdAt'])
@Index(['recipientId', 'readAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  recipientId!: string;

  @Column({ type: 'uuid' })
  actorId!: string;

  @Column({ type: 'varchar', length: 32 })
  type!: NotificationType;

  @Column({ type: 'uuid', nullable: true })
  postId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  commentId?: string | null;

  @Column({ type: DATE_TIME_COLUMN_TYPE, nullable: true })
  readAt?: Date | null;

  @CreateDateColumn({ type: DATE_TIME_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: DATE_TIME_COLUMN_TYPE })
  updatedAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipientId' })
  recipient!: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'actorId' })
  actor!: User;

  @ManyToOne(() => Post, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'postId' })
  post?: Post | null;

  @ManyToOne(() => Comment, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'commentId' })
  comment?: Comment | null;
}
