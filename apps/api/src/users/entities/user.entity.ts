import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Follows } from '../../follows/entities/follows.entity';
import { Post } from '../../posts/entities/post.entity';

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

  @OneToMany(() => Follows, (follow) => follow.follower)
  followingRelations?: Follows[];

  @OneToMany(() => Follows, (follow) => follow.following)
  followerRelations?: Follows[];

  @OneToMany(() => Post, (post) => post.user)
  posts?: Post[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
