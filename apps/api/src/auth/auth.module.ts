import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { JwtStrategy } from './jwt.strategy';
import { DemoSeeder } from './demo/demo.seeder';
import { DemoService } from './demo/demo.service';

export function getJwtSecret(
  configService: Pick<ConfigService, 'get'>,
): string {
  const secret = configService.get<string>('JWT_SECRET');
  if (!secret) {
    throw new Error('JWT_SECRET must be set');
  }
  return secret;
}

export function getJwtExpiresIn(
  configService: Pick<ConfigService, 'get'>,
): JwtSignOptions['expiresIn'] {
  return (configService.get<string>('JWT_EXPIRES_IN') ||
    '7d') as JwtSignOptions['expiresIn'];
}

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    TypeOrmModule.forFeature([User]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: getJwtSecret(configService),
        signOptions: {
          expiresIn: getJwtExpiresIn(configService),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, DemoSeeder, DemoService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
