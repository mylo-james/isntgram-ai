import { UserThrottlerGuard } from './user-throttler.guard';

describe('UserThrottlerGuard tracker selection', () => {
  const guard = new UserThrottlerGuard({} as never, {} as never, {} as never);
  const tracker = (request: Record<string, unknown>) =>
    (
      guard as unknown as {
        getTracker: (value: Record<string, unknown>) => Promise<string>;
      }
    ).getTracker(request);
  it('uses an authenticated user identity before an address', async () => {
    await expect(
      tracker({ user: { userId: 'user-1' }, ip: '203.0.113.1' }),
    ).resolves.toBe('user-user-1');
  });

  it('uses the provider-resolved request address and ignores forwarded headers', async () => {
    await expect(
      tracker({
        headers: { 'x-forwarded-for': '198.51.100.3, 10.0.0.1' },
        ip: '203.0.113.1',
      }),
    ).resolves.toBe('203.0.113.1');
  });

  it('falls back to unknown when the provider did not resolve an address', async () => {
    await expect(
      tracker({
        headers: { 'x-forwarded-for': 'not-an-address' },
        ip: '203.0.113.1',
      }),
    ).resolves.toBe('203.0.113.1');
    await expect(tracker({})).resolves.toBe('unknown');
  });
});
