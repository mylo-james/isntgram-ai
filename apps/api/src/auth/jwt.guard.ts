import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdmissionService } from '../common/admission/admission.service';
import { ADMISSION_ALREADY_CHARGED } from '../common/admission/admission.guard';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly admission: AdmissionService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const accepted = await super.canActivate(context);
    if (!accepted || !this.admission.isDeploymentMode())
      return Boolean(accepted);
    const request = context.switchToHttp().getRequest<{
      user?: { userId?: string; id?: string };
      [ADMISSION_ALREADY_CHARGED]?: boolean;
    }>();
    if (!request[ADMISSION_ALREADY_CHARGED]) {
      await this.admission.admitApiRequest({
        userId: request.user?.userId ?? request.user?.id,
      });
    }
    return true;
  }
}
