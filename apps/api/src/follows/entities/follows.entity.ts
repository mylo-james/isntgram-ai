import {
  Entity,
  Column,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  Index,
  Unique,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('follows')
@Unique('UQ_follower_following', ['followerId', 'followingId'])
@Index('IDX_follower', ['followerId'])
@Index('IDX_following', ['followingId'])
export class Follows {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  followerId!: string;

  @Column({ type: 'uuid' })
  followingId!: string;

  @ManyToOne(() => User, (user) => user.followingRelations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'followerId' })
  follower!: User;

  @ManyToOne(() => User, (user) => user.followerRelations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'followingId' })
  following!: User;

  @CreateDateColumn()
  createdAt!: Date;
}
