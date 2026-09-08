import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { OptionalJwtAuthGuard } from './optional-jwt.guard';

const context = (authorization?: string) => ({
  switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }),
});

describe('OptionalJwtAuthGuard', () => {
  const guard = new OptionalJwtAuthGuard();

  it.each([undefined, 'Basic ignored'])(
    'keeps a request anonymous without a Bearer credential: %s',
    (authorization) => {
      expect(
        guard.handleRequest(
          undefined,
          undefined,
          undefined,
          context(authorization) as unknown as ExecutionContext,
        ),
      ).toBeNull();
    },
  );

  it('rejects an invalid supplied Bearer credential with the existing boundary', () => {
    expect(() =>
      guard.handleRequest(
        new Error('bad token'),
        undefined,
        undefined,
        context('Bearer malformed') as unknown as ExecutionContext,
      ),
    ).toThrow('Invalid access token');
  });

  it('preserves Passport unauthorized errors for a supplied Bearer credential', () => {
    const error = new UnauthorizedException('Expired');
    expect(() =>
      guard.handleRequest(
        error,
        undefined,
        undefined,
        context('Bearer stale') as unknown as ExecutionContext,
      ),
    ).toThrow(error);
  });
});
