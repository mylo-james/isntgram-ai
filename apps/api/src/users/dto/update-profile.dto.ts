import { IsUUID, IsString, MinLength, Matches } from 'class-validator';

export class UpdateProfileDto {
  @IsUUID()
  id!: string;

  @IsString()
  @MinLength(1)
  fullName!: string;

  @IsString()
  @MinLength(3)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores',
  })
  username!: string;
}
