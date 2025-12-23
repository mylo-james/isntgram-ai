import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Post } from '../../posts/entities/post.entity';
import { Follow } from '../../follows/entities/follow.entity';
import { DATE_TIME_COLUMN_TYPE } from '../../common/column-types';

@Entity('users')
@Index(['email'], { unique: true })
@Index(['username'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  username!: string;

  @Column({ type: 'varchar', length: 100 })
  fullName!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  hashedPassword!: string;

  @Column({ type: 'integer', default: 0 })
  tokenVersion!: number;

  @Column({ type: 'boolean', default: false })
  isDemoUser!: boolean;

  @Column({ type: 'boolean', default: false })
  isDemoSeed!: boolean;

  @Column({ type: DATE_TIME_COLUMN_TYPE, nullable: true })
  demoExpiresAt?: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  profilePictureUrl?: string;

  @Column({ type: 'text', nullable: true })
  bio?: string;

  @Column({ type: 'integer', default: 0 })
  postsCount!: number;

  @Column({ type: 'integer', default: 0 })
  followerCount!: number;

  @Column({ type: 'integer', default: 0 })
  followingCount!: number;

  @CreateDateColumn({ type: DATE_TIME_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: DATE_TIME_COLUMN_TYPE })
  updatedAt!: Date;

  @OneToMany(() => Post, (post) => post.author)
  posts?: Post[];

  @OneToMany(() => Follow, (follow) => follow.follower)
  following?: Follow[];

  @OneToMany(() => Follow, (follow) => follow.following)
  followers?: Follow[];
}
