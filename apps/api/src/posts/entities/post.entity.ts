import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('posts')
@Index(['userId'])
@Index(['createdAt'])
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column('uuid')
  userId!: string;

  @Column({ type: 'text' })
  caption!: string;

  @Column({ type: 'varchar', length: 500 })
  imageUrl!: string;

  @Column({ type: 'integer', default: 0 })
  likesCount!: number;

  @Column({ type: 'integer', default: 0 })
  commentsCount!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}