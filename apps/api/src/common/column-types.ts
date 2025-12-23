export const DATE_TIME_COLUMN_TYPE: 'datetime' | 'timestamptz' =
  (process.env.NODE_ENV ?? 'development') === 'test'
    ? 'datetime'
    : 'timestamptz';
