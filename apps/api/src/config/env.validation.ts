import { plainToInstance } from 'class-transformer';
import { IsIn, IsOptional, IsString, validateSync } from 'class-validator';

const NODE_ENVS = ['development', 'test', 'production', 'ci'] as const;
type NodeEnv = (typeof NODE_ENVS)[number];

const AI_PROVIDERS = ['mock', 'openai'] as const;
type AiProvider = (typeof AI_PROVIDERS)[number];

class EnvironmentVariables {
  @IsOptional()
  @IsIn(NODE_ENVS)
  NODE_ENV?: NodeEnv;

  @IsOptional()
  @IsString()
  HOST?: string;

  @IsOptional()
  @IsString()
  PORT?: string;

  @IsOptional()
  @IsString()
  DATABASE_URL?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  DATABASE_SSL?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  DATABASE_SSL_REJECT_UNAUTHORIZED?: string;

  @IsOptional()
  @IsString()
  DATABASE_SSL_CA?: string;

  @IsString()
  JWT_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_EXPIRES_IN?: string;

  @IsOptional()
  @IsString()
  CORS_ORIGIN?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  DEMO_ENABLED?: string;

  @IsOptional()
  @IsString()
  DEMO_TTL_HOURS?: string;

  @IsOptional()
  @IsString()
  DEMO_EMAIL?: string;

  @IsOptional()
  @IsString()
  DEMO_USERNAME?: string;

  @IsOptional()
  @IsString()
  DEMO_FULL_NAME?: string;

  @IsOptional()
  @IsString()
  DEMO_PASSWORD?: string;

  @IsOptional()
  @IsString()
  S3_BUCKET?: string;

  @IsOptional()
  @IsString()
  S3_REGION?: string;

  @IsOptional()
  @IsString()
  S3_ACCESS_KEY_ID?: string;

  @IsOptional()
  @IsString()
  S3_SECRET_ACCESS_KEY?: string;

  @IsOptional()
  @IsString()
  S3_ENDPOINT?: string;

  @IsOptional()
  @IsString()
  S3_PUBLIC_BASE_URL?: string;

  @IsOptional()
  @IsString()
  MEDIA_ALLOWED_HOSTS?: string;

  @IsOptional()
  @IsString()
  MEDIA_MAX_UPLOAD_BYTES?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  REQUEST_LOGGING?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  METRICS_ENABLED?: string;

  @IsOptional()
  @IsString()
  THROTTLER_TTL?: string;

  @IsOptional()
  @IsString()
  THROTTLER_LIMIT?: string;

  @IsOptional()
  @IsIn(AI_PROVIDERS)
  AI_PROVIDER?: AiProvider;

  @IsOptional()
  @IsString()
  OPENAI_API_KEY?: string;

  @IsOptional()
  @IsString()
  OPENAI_MODEL?: string;
}

function formatEnvErrors(errors: ReturnType<typeof validateSync>): string {
  const lines = errors.flatMap((error) => {
    const constraints = error.constraints
      ? Object.values(error.constraints).map((msg) => `- ${msg}`)
      : [];
    return [`${error.property}:`, ...constraints];
  });
  return lines.join('\n');
}

export function validateEnv(config: Record<string, unknown>) {
  const env = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
  });
  const errors = validateSync(env, {
    skipMissingProperties: false,
  });
  if (errors.length > 0) {
    throw new Error(
      `Invalid environment variables:\n${formatEnvErrors(errors)}`,
    );
  }

  const nodeEnv = (env.NODE_ENV ?? 'development') as NodeEnv;

  if (nodeEnv === 'production') {
    if (!env.CORS_ORIGIN) {
      throw new Error('CORS_ORIGIN must be set in production');
    }
    if (!env.DATABASE_URL) {
      throw new Error('DATABASE_URL must be set in production');
    }
  }

  const provider = (env.AI_PROVIDER ?? 'mock').toLowerCase() as AiProvider;
  if (provider === 'openai' && !env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY must be set when AI_PROVIDER=openai');
  }

  return {
    ...env,
    NODE_ENV: nodeEnv,
    AI_PROVIDER: provider,
  };
}
