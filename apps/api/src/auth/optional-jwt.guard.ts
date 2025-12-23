import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(
    err: any,
    user: any,
    _info: any,
    context: ExecutionContext,
  ): TUser {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];
    const hasBearerToken =
      typeof authHeader === 'string' &&
      authHeader.trim().toLowerCase().startsWith('bearer ');

    if (hasBearerToken && (err || !user)) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException('Invalid access token');
    }

    // Missing auth header => treat as anonymous
    return (user ?? null) as TUser;
  }
}
