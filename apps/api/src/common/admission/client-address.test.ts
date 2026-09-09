import { createHmac } from 'crypto';
import { resolveAdmissionAddress } from './client-address';

const secret = 'a'.repeat(32);
const signed = (
  timestamp: string,
  address = '198.51.100.3',
  path = '/api/auth/demo',
) =>
  createHmac('sha256', secret)
    .update(`${timestamp}\nPOST\n${path}\n${address}`)
    .digest('hex');

describe('resolveAdmissionAddress', () => {
  it('uses a fresh HMAC-bound BFF visitor address', () => {
    const timestamp = String(Date.now());
    expect(
      resolveAdmissionAddress(
        {
          method: 'POST',
          path: '/api/auth/demo',
          ip: '10.0.0.2',
          headers: {
            'x-isntgram-client-address': '198.51.100.3',
            'x-isntgram-client-timestamp': timestamp,
            'x-isntgram-client-signature': signed(timestamp),
          },
        },
        secret,
      ),
    ).toBe('198.51.100.3');
  });

  it('falls back to the provider-resolved direct address for spoofed or expired BFF headers', () => {
    expect(
      resolveAdmissionAddress(
        {
          method: 'POST',
          path: '/api/auth/demo',
          ip: '10.0.0.2',
          headers: {
            'x-isntgram-client-address': '198.51.100.3',
            'x-isntgram-client-timestamp': String(Date.now()),
            'x-isntgram-client-signature': '00',
          },
        },
        secret,
      ),
    ).toBe('10.0.0.2');
    const stale = String(Date.now() - 61_000);
    expect(
      resolveAdmissionAddress(
        {
          method: 'POST',
          path: '/api/auth/demo',
          ip: '10.0.0.2',
          headers: {
            'x-isntgram-client-address': '198.51.100.3',
            'x-isntgram-client-timestamp': stale,
            'x-isntgram-client-signature': signed(stale),
          },
        },
        secret,
      ),
    ).toBe('10.0.0.2');
  });
});
