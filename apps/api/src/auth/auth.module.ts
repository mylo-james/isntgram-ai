import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthNextAuthController } from './auth-nextauth.controller';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([User])],
  controllers: [AuthController, AuthNextAuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
