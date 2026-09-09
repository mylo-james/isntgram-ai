import { portfolioEmbedOrigin, portfolioFrameHeaders } from '../portfolio-embed-config.cjs';

const localOrigin = 'https://mylos-mac-mini.tail0c4e0a.ts.net:8447';
const localEnv = { NODE_ENV: 'development', DEPLOYMENT_ENV: 'development', NEXT_PUBLIC_DEMO_ENABLED: 'true', NEXT_PUBLIC_APP_URL: 'https://mylos-mac-mini.tail0c4e0a.ts.net:8445', ISNTGRAM_PORTFOLIO_ORIGIN: localOrigin };

describe('explicit portfolio embedding', () => {
  it('denies ordinary framing and permits one exact local development parent', () => {
    expect(portfolioEmbedOrigin({})).toBe('');
    expect(portfolioFrameHeaders('')).toEqual([{ key: 'X-Frame-Options', value: 'DENY' }]);
    expect(portfolioEmbedOrigin(localEnv)).toBe(localOrigin);
  });

  it('uses the exact configured preview and production parent/child pairs', () => {
    expect(portfolioEmbedOrigin({ NODE_ENV: 'production', DEPLOYMENT_ENV: 'preview', NEXT_PUBLIC_DEMO_ENABLED: 'true', NEXT_PUBLIC_APP_URL: 'https://isntgram-preview.mjames.dev', ISNTGRAM_PORTFOLIO_ORIGIN: 'https://preview.mjames.dev' })).toBe('https://preview.mjames.dev');
    expect(portfolioEmbedOrigin({ NODE_ENV: 'production', DEPLOYMENT_ENV: 'production', NEXT_PUBLIC_DEMO_ENABLED: 'true', NEXT_PUBLIC_APP_URL: 'https://isntgram.mjames.dev', ISNTGRAM_PORTFOLIO_ORIGIN: 'https://mjames.dev' })).toBe('https://mjames.dev');
  });

  it('permits the isolated compiled local test pair only when explicitly named', () => {
    const config = { NODE_ENV: 'production', DEPLOYMENT_ENV: 'local-test', NEXT_PUBLIC_DEMO_ENABLED: 'true', NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:4520', ISNTGRAM_PORTFOLIO_ORIGIN: 'http://127.0.0.1:4510' };
    expect(portfolioEmbedOrigin(config)).toBe(config.ISNTGRAM_PORTFOLIO_ORIGIN);
    expect(() => portfolioEmbedOrigin({ ...config, DEPLOYMENT_ENV: 'production' })).toThrow();
    expect(() => portfolioEmbedOrigin({ ...config, NEXT_PUBLIC_APP_URL: 'https://isntgram.mjames.dev' })).toThrow();
    expect(() => portfolioEmbedOrigin({ ...config, ISNTGRAM_PORTFOLIO_ORIGIN: 'http://127.0.0.1:9999' })).toThrow();
  });

  it.each([
    { DEPLOYMENT_ENV: 'preview', NEXT_PUBLIC_APP_URL: 'https://isntgram-preview.mjames.dev', ISNTGRAM_PORTFOLIO_ORIGIN: 'https://mjames.dev' },
    { DEPLOYMENT_ENV: 'production', NEXT_PUBLIC_APP_URL: 'https://isntgram-preview.mjames.dev', ISNTGRAM_PORTFOLIO_ORIGIN: 'https://mjames.dev' },
    { DEPLOYMENT_ENV: 'preview', NEXT_PUBLIC_APP_URL: 'https://isntgram-preview.mjames.dev', ISNTGRAM_PORTFOLIO_ORIGIN: 'https://preview.mjames.dev/path' },
    { ...localEnv, NEXT_PUBLIC_DEMO_ENABLED: 'false' },
  ])('rejects unsupported configuration %j', (patch) => {
    expect(() => portfolioEmbedOrigin({ ...localEnv, ...patch })).toThrow();
  });
});
