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

  @ApiProperty({ minimum: 0 })
  postCount!: number;

  @ApiProperty({ minimum: 0 })
  followerCount!: number;

  @ApiProperty({ minimum: 0 })
  followingCount!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
