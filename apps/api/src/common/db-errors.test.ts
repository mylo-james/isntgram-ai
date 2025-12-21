import { QueryFailedError } from 'typeorm';
import { isUniqueConstraintError } from './db-errors';

describe('isUniqueConstraintError', () => {
  it('returns false for non-QueryFailedError', () => {
    expect(isUniqueConstraintError(new Error('nope'))).toBe(false);
  });

  it('returns true for matching error code', () => {
    const err = new QueryFailedError('query', [], {
      code: '23505',
    } as unknown as Error);

    expect(isUniqueConstraintError(err)).toBe(true);
  });

  it('returns true for matching errno', () => {
    const err = new QueryFailedError('query', [], {
      errno: 'SQLITE_CONSTRAINT',
    } as unknown as Error);

    expect(isUniqueConstraintError(err)).toBe(true);
  });

  it('returns false for non-matching code', () => {
    const err = new QueryFailedError('query', [], {
      code: 'SOME_OTHER',
    } as unknown as Error);

    expect(isUniqueConstraintError(err)).toBe(false);
  });
});
