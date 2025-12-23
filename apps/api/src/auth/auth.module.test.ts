import { getJwtExpiresIn, getJwtSecret } from './auth.module';

describe('AuthModule JWT config helpers', () => {
  describe('getJwtSecret', () => {
    it('returns the configured secret', () => {
      const secret = getJwtSecret({ get: jest.fn().mockReturnValue('secret') });
      expect(secret).toBe('secret');
    });

    it('throws when the secret is missing', () => {
      expect(() =>
        getJwtSecret({ get: jest.fn().mockReturnValue(undefined) }),
      ).toThrow('JWT_SECRET must be set');
    });
  });

  describe('getJwtExpiresIn', () => {
    it('returns configured expiry when set', () => {
      const expiresIn = getJwtExpiresIn({
        get: jest.fn().mockReturnValue('1h'),
      });
      expect(expiresIn).toBe('1h');
    });

    it('falls back to 7d when missing', () => {
      const expiresIn = getJwtExpiresIn({
        get: jest.fn().mockReturnValue(undefined),
      });
      expect(expiresIn).toBe('7d');
    });
  });
});
