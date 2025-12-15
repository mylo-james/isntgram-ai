import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

type AuthenticatedRequest = Request & { user?: { email?: string } };

@Injectable()
export class DemoReadOnlyGuard implements CanActivate {
  constructor(@Optional() private readonly configService?: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const demoEmail =
      this.configService?.get<string>('DEMO_EMAIL') ||
      process.env.DEMO_EMAIL ||
      'demo@isntgram.ai';

    if (req.user?.email && req.user.email === demoEmail) {
      throw new ForbiddenException('Demo mode: this action is read-only');
    }

    return true;
  }
}
