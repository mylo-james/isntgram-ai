import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';

describe('safe writing capabilities', () => {
  const original = process.env.AI_PROVIDER;
  afterEach(() => {
    if (original === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = original;
  });
  it.each([
    [
      'mock',
      undefined,
      { mode: 'mock', available: true, label: 'Demo text formatter' },
    ],
    [
      'openai',
      'private-key-never-returned',
      { mode: 'openai', available: true, label: 'AI writing suggestion' },
    ],
    [
      'openai',
      '',
      { mode: 'openai', available: false, label: 'AI writing suggestion' },
    ],
    [
      'disabled',
      undefined,
      {
        mode: 'disabled',
        available: false,
        label: 'Writing suggestions unavailable',
      },
    ],
  ])(
    'discloses %s without credentials or provider access',
    (provider, key, expected) => {
      const service = new AiService(
        new ConfigService({ AI_PROVIDER: provider, OPENAI_API_KEY: key }),
      );
      expect(new AiController(service).capabilities()).toEqual(expected);
    },
  );
  it('uses the existing mock default when no provider is configured', () => {
    delete process.env.AI_PROVIDER;
    expect(new AiService().capabilities().mode).toBe('mock');
  });
});
