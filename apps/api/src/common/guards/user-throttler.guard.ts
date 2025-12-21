import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const nodeEnv = process.env.NODE_ENV ?? 'development';
    if (nodeEnv === 'test' || nodeEnv === 'ci') {
      return true;
    }

    return super.canActivate(context);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = req.user?.userId ?? req.user?.id;
    if (typeof userId === 'string' && userId.trim().length > 0) {
      return `user-${userId}`;
    }

    const forwardedFor = req.headers?.['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.trim().length > 0) {
      return forwardedFor.split(',')[0]?.trim() ?? req.ip;
    }

    return req.ip;
  }
}
