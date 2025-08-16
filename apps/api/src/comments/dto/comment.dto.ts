import { IsString, IsNotEmpty, IsUUID, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @IsUUID(4, { message: 'Post ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Post ID is required' })
  postId!: string;

  @IsString({ message: 'Content must be a string' })
  @IsNotEmpty({ message: 'Content is required' })
  @MaxLength(500, { message: 'Comment must not exceed 500 characters' })
  content!: string;
}

export class UpdateCommentDto {
  @IsString({ message: 'Content must be a string' })
  @IsNotEmpty({ message: 'Content is required' })
  @MaxLength(500, { message: 'Comment must not exceed 500 characters' })
  content!: string;
}

export class CommentResponseDto {
  id!: string;
  userId!: string;
  postId!: string;
  content!: string;
  createdAt!: Date;
  updatedAt!: Date;
  user?: {
    id: string;
    username: string;
    fullName: string;
    profilePictureUrl?: string;
  };
}