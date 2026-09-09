import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AdmissionService } from './admission.service';
import { resolveAdmissionAddress } from './client-address';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export const ADMISSION_TRACKER = '__isntgramAdmissionTracker';
export const ADMISSION_ALREADY_CHARGED = '__isntgramAdmissionAlreadyCharged';

@Injectable()
export class AdmissionGuard implements CanActivate {
  constructor(
    private readonly admission: AdmissionService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<any>();
    if (request.url === '/api/health' || request.url === '/api/ready')
      return true;
    if (!this.admission.isDeploymentMode()) return true;
    const address = resolveAdmissionAddress(
      request,
      process.env.BFF_PROXY_SECRET,
    );
    const token =
      typeof request.headers?.authorization === 'string'
        ? request.headers.authorization.match(/^Bearer\s+(.+)$/i)?.[1]
        : undefined;
    let userId: string | undefined;
    if (token) {
      try {
        const payload = await this.jwt.verifyAsync<{ sub?: string }>(token, {
          secret: this.config.get<string>('JWT_SECRET'),
        });
        userId = typeof payload.sub === 'string' ? payload.sub : undefined;
      } catch {
        // Invalid bearer credentials are intentionally admitted as unauthenticated.
      }
    }
    await this.admission.admitApiRequest({
      userId,
      address,
    });
    request[ADMISSION_TRACKER] = userId ? `user-${userId}` : address;
    if (userId) request[ADMISSION_ALREADY_CHARGED] = true;
    return true;
  }
}
