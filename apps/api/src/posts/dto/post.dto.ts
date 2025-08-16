import { IsString, IsNotEmpty, IsUrl, MaxLength, IsOptional } from 'class-validator';

export class CreatePostDto {
  @IsString({ message: 'Caption must be a string' })
  @IsOptional()
  @MaxLength(2200, { message: 'Caption must not exceed 2200 characters' })
  caption?: string;

  @IsString({ message: 'Image URL must be a string' })
  @IsNotEmpty({ message: 'Image URL is required' })
  @IsUrl({}, { message: 'Image URL must be a valid URL' })
  imageUrl!: string;
}

export class PostResponseDto {
  id!: string;
  userId!: string;
  caption?: string;
  imageUrl!: string;
  likesCount!: number;
  commentsCount!: number;
  createdAt!: Date;
  updatedAt!: Date;
  user?: {
    id: string;
    username: string;
    fullName: string;
    profilePictureUrl?: string;
  };
}