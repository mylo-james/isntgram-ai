import { IsUUID, IsNotEmpty } from 'class-validator';

export class FollowDto {
  @IsUUID(4, { message: 'User ID must be a valid UUID' })
  @IsNotEmpty({ message: 'User ID is required' })
  userId!: string;
}

export class FollowResponseDto {
  id!: string;
  followerId!: string;
  followingId!: string;
  createdAt!: Date;
}

export class FollowStatsDto {
  followerCount!: number;
  followingCount!: number;
  isFollowing!: boolean;
}