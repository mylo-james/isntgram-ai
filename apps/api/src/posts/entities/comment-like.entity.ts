import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Comment } from './comment.entity';
import { User } from '../../users/entities/user.entity';
import { DATE_TIME_COLUMN_TYPE } from '../../common/column-types';

@Entity('comment_likes')
@Unique(['commentId', 'userId'])
@Index(['commentId', 'createdAt'])
@Index(['userId', 'createdAt'])
export class CommentLike {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  commentId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => Comment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'commentId' })
  comment!: Comment;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @CreateDateColumn({ type: DATE_TIME_COLUMN_TYPE })
  createdAt!: Date;
}
