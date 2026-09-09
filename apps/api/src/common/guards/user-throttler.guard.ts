import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ADMISSION_TRACKER } from '../admission/admission.guard';

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
    const admittedTracker = req[ADMISSION_TRACKER];
    if (typeof admittedTracker === 'string' && admittedTracker)
      return admittedTracker;
    const userId = req.user?.userId ?? req.user?.id;
    if (typeof userId === 'string' && userId.trim().length > 0) {
      return `user-${userId}`;
    }

    return typeof req.ip === 'string' && req.ip ? req.ip : 'unknown';
  }
}
