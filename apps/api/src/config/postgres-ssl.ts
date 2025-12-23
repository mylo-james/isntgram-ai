export type PostgresSslOptions =
  | false
  | {
      rejectUnauthorized: boolean;
      ca?: string;
    };

function parseBooleanEnv(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

export function getPostgresSslOptions(
  env: NodeJS.ProcessEnv,
): PostgresSslOptions {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const enabled = parseBooleanEnv(env.DATABASE_SSL, nodeEnv === 'production');

  if (!enabled) {
    return false;
  }

  const rejectUnauthorized = parseBooleanEnv(
    env.DATABASE_SSL_REJECT_UNAUTHORIZED,
    true,
  );

  const ca = env.DATABASE_SSL_CA?.trim();
  return ca ? { rejectUnauthorized, ca } : { rejectUnauthorized };
}
