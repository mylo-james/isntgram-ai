import { ServiceUnavailableException } from '@nestjs/common';
import { AiService } from './ai.service';

describe('AiService', () => {
  const originalProvider = process.env.AI_PROVIDER;
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_MODEL;
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env.AI_PROVIDER = originalProvider;
    process.env.OPENAI_API_KEY = originalApiKey;
    process.env.OPENAI_MODEL = originalModel;
    global.fetch = originalFetch;
  });

  it('rewrites content using the mock provider', async () => {
    process.env.AI_PROVIDER = 'mock';
    const service = new AiService();

    const result = await service.rewrite('user-1', {
      content: 'hello    world',
      tone: 'professional',
      maxLength: 2000,
    });

    expect(result.provider).toBe('mock');
    expect(result.content).toBe('hello world.');
  });

  it('throws when AI_PROVIDER is unsupported', async () => {
    process.env.AI_PROVIDER = 'unknown';
    const service = new AiService();

    await expect(
      service.rewrite('user-1', { content: 'hello world' } as any),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('throws when AI_PROVIDER=openai but no API key is set', async () => {
    process.env.AI_PROVIDER = 'openai';
    delete process.env.OPENAI_API_KEY;
    const service = new AiService();

    await expect(
      service.rewrite('user-1', { content: 'hello world' } as any),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rewrites content using the openai provider', async () => {
    process.env.AI_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_MODEL = 'gpt-test';

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'rewritten content' } }],
      }),
    }) as unknown as typeof fetch;

    const service = new AiService();
    const result = await service.rewrite('user-1', {
      content: 'hello world',
      tone: 'professional',
      maxLength: 2000,
    });

    expect(result).toEqual({
      content: 'rewritten content',
      provider: 'openai',
      model: 'gpt-test',
    });
  });

  it('throws when the openai provider responds with an error', async () => {
    process.env.AI_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'test-key';

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: { message: 'rate limited' },
      }),
    }) as unknown as typeof fetch;

    const service = new AiService();

    await expect(
      service.rewrite('user-1', { content: 'hello world' } as any),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
