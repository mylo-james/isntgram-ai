import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { DATE_TIME_COLUMN_TYPE } from '../../common/column-types';

@Entity('follows')
@Unique('UQ_FOLLOWS_FOLLOWER_FOLLOWING', ['followerId', 'followingId'])
@Index('IDX_FOLLOWS_FOLLOWER_CREATED_AT', ['followerId', 'createdAt'])
@Index('IDX_FOLLOWS_FOLLOWING_CREATED_AT', ['followingId', 'createdAt'])
export class Follow {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  followerId!: string;

  @Column({ type: 'uuid' })
  followingId!: string;

  @ManyToOne(() => User, (user) => user.following, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'followerId' })
  follower!: User;

  @ManyToOne(() => User, (user) => user.followers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'followingId' })
  following!: User;

  @CreateDateColumn({ type: DATE_TIME_COLUMN_TYPE })
  createdAt!: Date;
}
