import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class SignInDto {
  @ApiProperty({ format: 'email' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email!: string;

  @ApiProperty({ format: 'password', minLength: 1, maxLength: 128 })
  @IsString({ message: 'Password must be a string' })
  @MinLength(1, { message: 'Password is required' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  password!: string;
}
