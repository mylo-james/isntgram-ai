import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('returns normalized safe defaults from a synthetic minimal record', () => {
    expect(validateEnv({ JWT_SECRET: 'test-secret' })).toMatchObject({
      JWT_SECRET: 'test-secret',
      NODE_ENV: 'development',
      AI_PROVIDER: 'mock',
    });
  });

  it.each([
    [{}, /JWT_SECRET/],
    [{ JWT_SECRET: 'test', METRICS_ENABLED: 'perhaps' }, /METRICS_ENABLED/],
    [{ JWT_SECRET: 'test', AI_PROVIDER: 'unsupported' }, /AI_PROVIDER/],
  ])('rejects invalid declared input %#', (input, message) => {
    expect(() => validateEnv(input)).toThrow(message);
  });

  it('requires production connection fields and an OpenAI key only in their applicable modes', () => {
    expect(() =>
      validateEnv({ JWT_SECRET: 'test', NODE_ENV: 'production' }),
    ).toThrow('CORS_ORIGIN');
    expect(() =>
      validateEnv({
        JWT_SECRET: 'test',
        NODE_ENV: 'production',
        CORS_ORIGIN: 'http://127.0.0.1:4320',
      }),
    ).toThrow('DATABASE_URL');
    expect(() =>
      validateEnv({ JWT_SECRET: 'test', AI_PROVIDER: 'openai' }),
    ).toThrow('OPENAI_API_KEY');

    expect(
      validateEnv({
        JWT_SECRET: 'test',
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://example.test',
        DATABASE_URL: 'postgresql://example.test/db',
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: 'synthetic-key',
      }),
    ).toMatchObject({ NODE_ENV: 'production', AI_PROVIDER: 'openai' });
  });

  it.each([
    { S3_PRESIGN_ENDPOINT: 'https://phone.example' },
    { S3_DISPLAY_BASE_URL: 'https://phone.example' },
    {
      S3_PRESIGN_ENDPOINT: 'http://phone.example',
      S3_DISPLAY_BASE_URL: 'https://phone.example',
    },
    {
      S3_PRESIGN_ENDPOINT: 'https://127.0.0.1',
      S3_DISPLAY_BASE_URL: 'https://phone.example/isntgram-v1-media',
    },
    {
      S3_PRESIGN_ENDPOINT: 'https://phone.example:9444',
      S3_DISPLAY_BASE_URL: 'https://phone.example:9445/isntgram-v1-media',
    },
    {
      S3_PRESIGN_ENDPOINT: 'https://phone.example/isntgram-v1-media',
      S3_DISPLAY_BASE_URL: 'https://phone.example/isntgram-v1-media',
    },
  ])('rejects incomplete or unsafe phone media origins: %j', (input) => {
    expect(() => validateEnv({ JWT_SECRET: 'test', ...input })).toThrow();
  });

  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '8.8.8.8',
    '[::1]',
    '[::ffff:127.0.0.1]',
    '[fd00::1]',
    '[2001:4860:4860::8888]',
  ])('rejects paired phone media IP literals: %s', (host) => {
    expect(() =>
      validateEnv({
        JWT_SECRET: 'test',
        S3_PRESIGN_ENDPOINT: `https://${host}`,
        S3_DISPLAY_BASE_URL: `https://${host}/isntgram-v1-media`,
      }),
    ).toThrow('Phone media URL must not be loopback or an IP literal');
  });

  it('retains paired HTTPS phone media origins as optional configuration', () => {
    expect(
      validateEnv({
        JWT_SECRET: 'test',
        S3_PRESIGN_ENDPOINT: 'https://phone.example',
        S3_DISPLAY_BASE_URL: 'https://phone.example/isntgram-v1-media',
      }),
    ).toMatchObject({
      S3_PRESIGN_ENDPOINT: 'https://phone.example',
      S3_DISPLAY_BASE_URL: 'https://phone.example/isntgram-v1-media',
    });
  });
});
