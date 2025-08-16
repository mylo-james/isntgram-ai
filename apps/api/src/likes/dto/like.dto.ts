import { IsUUID, IsNotEmpty } from 'class-validator';

export class LikeDto {
  @IsUUID(4, { message: 'Post ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Post ID is required' })
  postId!: string;
}

export class LikeResponseDto {
  id!: string;
  userId!: string;
  postId!: string;
  createdAt!: Date;
}

export class LikeStatsDto {
  likesCount!: number;
  isLiked!: boolean;
}