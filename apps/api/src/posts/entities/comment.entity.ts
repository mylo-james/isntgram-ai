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
import { Post } from './post.entity';
import { User } from '../../users/entities/user.entity';
import { DATE_TIME_COLUMN_TYPE } from '../../common/column-types';

@Entity('comments')
@Index(['postId', 'createdAt'])
@Index(['authorId', 'createdAt'])
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  postId!: string;

  @Column({ type: 'uuid' })
  authorId!: string;

  @ManyToOne(() => Post, (post) => post.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post!: Post;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author!: User;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'integer', default: 0 })
  likeCount!: number;

  @CreateDateColumn({ type: DATE_TIME_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: DATE_TIME_COLUMN_TYPE })
  updatedAt!: Date;
}
