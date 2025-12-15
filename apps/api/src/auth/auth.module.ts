import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthNextAuthController } from './auth-nextauth.controller';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { JwtStrategy } from './jwt.strategy';
import { Post as PostEntity } from '../posts/entities/post.entity';

function parseJwtExpiresInSeconds(raw: string): number {
  const normalized = raw.trim();

  const numericSeconds = Number(normalized);
  if (Number.isFinite(numericSeconds) && numericSeconds > 0) {
    return numericSeconds;
  }

  const match = normalized.match(/^(\d+)\s*(ms|s|m|h|d|w|y)$/i);
  if (!match) {
    throw new Error(
      "JWT_EXPIRES_IN must be a number of seconds or a duration like '7d', '24h', or '15m'.",
    );
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  const seconds = (() => {
    switch (unit) {
      case 'ms':
        return amount / 1000;
      case 's':
        return amount;
      case 'm':
        return amount * 60;
      case 'h':
        return amount * 60 * 60;
      case 'd':
        return amount * 60 * 60 * 24;
      case 'w':
        return amount * 60 * 60 * 24 * 7;
      case 'y':
        return amount * 60 * 60 * 24 * 365;
      default:
        return Number.NaN;
    }
  })();

  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(
      "JWT_EXPIRES_IN must be a number of seconds or a duration like '7d', '24h', or '15m'.",
    );
  }

  return Math.floor(seconds);
}

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([User, PostEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: (() => {
          const secret = config.get<string>('JWT_SECRET');
          if (!secret) {
            throw new Error(
              'JWT_SECRET must be set. See ENVIRONMENT.md and apps/api/env.example.',
            );
          }
          return secret;
        })(),
        signOptions: {
          expiresIn: parseJwtExpiresInSeconds(
            config.get<string>('JWT_EXPIRES_IN') || '7d',
          ),
        },
      }),
    }),
  ],
  controllers: [AuthController, AuthNextAuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
