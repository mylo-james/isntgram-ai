import { AdmissionGuard } from './admission.guard';
import { AdmissionService } from './admission.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('AdmissionGuard', () => {
  const admission = {
    isDeploymentMode: jest.fn(),
    admitApiRequest: jest.fn(),
  } as unknown as AdmissionService;
  const jwt = { verifyAsync: jest.fn() } as unknown as JwtService;
  const config = {
    get: jest.fn().mockReturnValue('test-secret'),
  } as unknown as ConfigService;
  const guard = new AdmissionGuard(admission, jwt, config);
  const context = (request: Record<string, unknown>) =>
    ({ switchToHttp: () => ({ getRequest: () => request }) }) as any;

  beforeEach(() => jest.clearAllMocks());

  it('leaves ordinary app mode unchanged', async () => {
    (admission.isDeploymentMode as jest.Mock).mockReturnValue(false);
    await expect(guard.canActivate(context({ ip: '127.0.0.1' }))).resolves.toBe(
      true,
    );
    expect(admission.admitApiRequest).not.toHaveBeenCalled();
  });

  it('keeps liveness and readiness independent of the database admission store', async () => {
    (admission.isDeploymentMode as jest.Mock).mockReturnValue(true);
    await expect(
      guard.canActivate(context({ url: '/api/health' })),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(context({ url: '/api/ready' })),
    ).resolves.toBe(true);
    expect(admission.admitApiRequest).not.toHaveBeenCalled();
  });

  it('admits a valid bearer as its user without consuming the shared unauthenticated address bucket', async () => {
    (admission.isDeploymentMode as jest.Mock).mockReturnValue(true);
    (jwt.verifyAsync as jest.Mock).mockResolvedValue({ sub: 'user-1' });
    const request = {
      ip: '203.0.113.7',
      headers: { authorization: 'Bearer valid-token' },
    };
    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(admission.admitApiRequest).toHaveBeenCalledWith({
      userId: 'user-1',
      address: '203.0.113.7',
    });
    expect(request).toMatchObject({
      __isntgramAdmissionAlreadyCharged: true,
      __isntgramAdmissionTracker: 'user-user-1',
    });
  });

  it('charges invalid bearer credentials to the unauthenticated address bucket', async () => {
    (admission.isDeploymentMode as jest.Mock).mockReturnValue(true);
    (jwt.verifyAsync as jest.Mock).mockRejectedValue(
      new Error('bad signature'),
    );
    await guard.canActivate(
      context({
        ip: '203.0.113.8',
        headers: { authorization: 'Bearer invalid-token' },
      }),
    );
    expect(admission.admitApiRequest).toHaveBeenCalledWith({
      userId: undefined,
      address: '203.0.113.8',
    });
  });

  it('uses the resolved trusted address, never a caller-supplied forwarded header', async () => {
    (admission.isDeploymentMode as jest.Mock).mockReturnValue(true);
    await guard.canActivate(
      context({
        ip: '203.0.113.11',
        headers: { 'x-forwarded-for': '198.51.100.99' },
      }),
    );
    expect(admission.admitApiRequest).toHaveBeenCalledWith({
      userId: undefined,
      address: '203.0.113.11',
    });
  });
});
