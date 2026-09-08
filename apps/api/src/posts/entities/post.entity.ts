import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Like } from './like.entity';
import { Comment } from './comment.entity';
import { DATE_TIME_COLUMN_TYPE } from '../../common/column-types';

@Entity('posts')
@Index(['authorId', 'createdAt'])
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  authorId!: string;

  @ManyToOne(() => User, (user) => user.posts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author!: User;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  mediaUrl?: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  mediaAltText?: string;

  @Column({ type: 'integer', default: 0 })
  likeCount!: number;

  @Column({ type: 'integer', default: 0 })
  commentCount!: number;

  @CreateDateColumn({ type: DATE_TIME_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: DATE_TIME_COLUMN_TYPE })
  updatedAt!: Date;

  @OneToMany(() => Like, (like) => like.post)
  likes?: Like[];

  @OneToMany(() => Comment, (comment) => comment.post)
  comments?: Comment[];
}
