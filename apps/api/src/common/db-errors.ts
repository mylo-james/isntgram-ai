import { QueryFailedError } from 'typeorm';

const UNIQUE_CODES = new Set([
  '23505',
  'SQLITE_CONSTRAINT',
  'SQLITE_CONSTRAINT_UNIQUE',
]);

export function isUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const driverError = error.driverError as
    | { code?: string; errno?: string }
    | undefined;
  const code = driverError?.code || driverError?.errno;
  return typeof code === 'string' && UNIQUE_CODES.has(code);
}
