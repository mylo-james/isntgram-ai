import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PublicUserProfileDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty()
  fullName!: string;

  @ApiPropertyOptional()
  profilePictureUrl?: string;

  @ApiPropertyOptional()
  bio?: string;

  @ApiProperty()
  postCount!: number;

  @ApiProperty()
  followerCount!: number;

  @ApiProperty()
  followingCount!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
