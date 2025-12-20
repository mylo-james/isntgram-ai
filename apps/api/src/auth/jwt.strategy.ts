import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthUser, JwtPayload } from './jwt.types';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET must be set');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      select: ['id', 'email', 'username', 'tokenVersion'],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }

    const tokenVersion = payload.tokenVersion ?? 0;
    if ((user.tokenVersion ?? 0) !== tokenVersion) {
      throw new UnauthorizedException('Token revoked');
    }

    return {
      userId: user.id,
      email: user.email,
      username: user.username,
    };
  }
}
