import { IsUUID } from 'class-validator';

export class FollowRequestDto {
  @IsUUID()
  targetUserId!: string;
}
