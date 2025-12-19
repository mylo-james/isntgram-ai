import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  AiRewriteRequestDto,
  AiRewriteResponseDto,
} from './dto/ai-rewrite.dto';

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function ensureTerminalPunctuation(value: string): string {
  if (!value) return value;
  if (/[.!?]$/.test(value)) return value;
  return `${value}.`;
}

function clampMaxLength(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return value.slice(0, maxLength).replace(/\s+$/g, '');
}

@Injectable()
export class AiService {
  async rewrite(
    _userId: string,
    request: AiRewriteRequestDto,
  ): Promise<AiRewriteResponseDto> {
    const provider = (process.env.AI_PROVIDER || 'mock').toLowerCase();
    const tone = request.tone ?? 'professional';
    const maxLength = request.maxLength ?? 2000;

    if (provider === 'mock') {
      const cleaned = normalizeWhitespace(request.content);
      const rewritten = clampMaxLength(
        ensureTerminalPunctuation(cleaned),
        maxLength,
      );
      return {
        content: rewritten,
        provider: 'mock',
      };
    }

    if (provider === 'openai') {
      return this.rewriteWithOpenAi(request.content, tone, maxLength);
    }

    throw new ServiceUnavailableException(
      `Unsupported AI provider: ${provider}`,
    );
  }

  private async rewriteWithOpenAi(
    content: string,
    tone: string,
    maxLength: number,
  ): Promise<AiRewriteResponseDto> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'OPENAI_API_KEY must be set when AI_PROVIDER=openai',
      );
    }

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const prompt = [
      `Rewrite the following post in a ${tone} tone.`,
      `Keep meaning and facts. Avoid hashtags and emojis.`,
      `Max ${maxLength} characters.`,
      '',
      content,
    ].join('\n');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            temperature: 0.4,
            messages: [
              {
                role: 'system',
                content:
                  'You are a helpful writing assistant for short social posts.',
              },
              { role: 'user', content: prompt },
            ],
          }),
          signal: controller.signal,
        },
      );

      const data = (await response.json().catch(() => null)) as {
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        throw new ServiceUnavailableException(
          data?.error?.message || 'AI provider request failed',
        );
      }

      const rewritten = data?.choices?.[0]?.message?.content;
      if (!rewritten || typeof rewritten !== 'string') {
        throw new InternalServerErrorException(
          'AI provider returned an invalid response',
        );
      }

      return {
        content: clampMaxLength(normalizeWhitespace(rewritten), maxLength),
        provider: 'openai',
        model,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
