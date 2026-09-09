import { JwtAuthGuard } from './jwt.guard';
import { AdmissionService } from '../common/admission/admission.service';

describe('JwtAuthGuard', () => {
  const admission = {
    isDeploymentMode: jest.fn(),
    admitApiRequest: jest.fn(),
  } as unknown as AdmissionService;
  const context = (request: Record<string, unknown>) =>
    ({ switchToHttp: () => ({ getRequest: () => request }) }) as never;
  const parent = Object.getPrototypeOf(JwtAuthGuard.prototype) as {
    canActivate: (context: unknown) => Promise<boolean>;
  };

  beforeEach(() => jest.clearAllMocks());

  it('counts a verified deployment user only after passport accepts the request', async () => {
    jest.spyOn(parent, 'canActivate').mockResolvedValue(true);
    (admission.isDeploymentMode as jest.Mock).mockReturnValue(true);
    const guard = new JwtAuthGuard(admission);

    await expect(
      guard.canActivate(context({ user: { id: 'user-1' } })),
    ).resolves.toBe(true);
    expect(admission.admitApiRequest).toHaveBeenCalledWith({
      userId: 'user-1',
    });
  });

  it('does not count rejected or ordinary-app requests as authenticated admission', async () => {
    const activate = jest.spyOn(parent, 'canActivate');
    const guard = new JwtAuthGuard(admission);
    activate.mockResolvedValue(false);
    await expect(
      guard.canActivate(context({ user: { userId: 'user-1' } })),
    ).resolves.toBe(false);
    (admission.isDeploymentMode as jest.Mock).mockReturnValue(false);
    activate.mockResolvedValue(true);
    await expect(
      guard.canActivate(context({ user: { userId: 'user-1' } })),
    ).resolves.toBe(true);
    expect(admission.admitApiRequest).not.toHaveBeenCalled();
  });

  it('does not charge a second time when global admission already verified the bearer', async () => {
    jest.spyOn(parent, 'canActivate').mockResolvedValue(true);
    (admission.isDeploymentMode as jest.Mock).mockReturnValue(true);
    const guard = new JwtAuthGuard(admission);
    await expect(
      guard.canActivate(
        context({
          user: { userId: 'user-1' },
          __isntgramAdmissionAlreadyCharged: true,
        }),
      ),
    ).resolves.toBe(true);
    expect(admission.admitApiRequest).not.toHaveBeenCalled();
  });
});
