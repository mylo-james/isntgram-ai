import {
  Injectable,
  ServiceUnavailableException,
  BadGatewayException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'node:crypto';
import {
  CaptionSuggestionsDto,
  CaptionTone,
} from './dto/caption-suggestions.dto';
import { CaptionSuggestionsResponseDto } from './dto/caption-suggestions-response.dto';

type ResponsesApiMessage = {
  type: 'message';
  role: 'assistant' | 'user' | 'system';
  content: Array<
    | { type: 'output_text'; text: string }
    | { type: 'refusal'; refusal: string }
    | Record<string, unknown>
  >;
};

type ResponsesApiResponse = {
  output?: ResponsesApiMessage[];
};

function hashSafetyIdentifier(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function extractFirstOutputText(payload: unknown): string {
  const res = payload as ResponsesApiResponse;
  const output = Array.isArray(res.output) ? res.output : [];

  for (const item of output) {
    if (!item || item.type !== 'message' || item.role !== 'assistant') continue;
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (!part || typeof part !== 'object') continue;
      if ((part as { type?: unknown }).type === 'refusal') {
        const refusal = (part as { refusal?: unknown }).refusal;
        if (typeof refusal === 'string' && refusal.length) {
          throw new ForbiddenException(refusal);
        }
      }
      if ((part as { type?: unknown }).type === 'output_text') {
        const text = (part as { text?: unknown }).text;
        if (typeof text === 'string' && text.length) return text;
      }
    }
  }

  throw new BadGatewayException('AI response was missing output text');
}

@Injectable()
export class AiService {
  constructor(private readonly configService: ConfigService) {}

  async captionSuggestions(
    user: { userId: string; username: string; email: string },
    dto: CaptionSuggestionsDto,
  ): Promise<CaptionSuggestionsResponseDto> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'AI is not configured (missing OPENAI_API_KEY)',
      );
    }

    const demoEmail =
      this.configService.get<string>('DEMO_EMAIL') || 'demo@isntgram.ai';
    const demoAllowAi =
      this.configService.get<string>('DEMO_ALLOW_AI') === 'true';
    if (
      user.email &&
      user.email.toLowerCase() === demoEmail.toLowerCase() &&
      !demoAllowAi
    ) {
      throw new ForbiddenException('Demo mode: AI is disabled');
    }

    const model =
      this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';
    const count = dto.count ?? 3;
    const tone = dto.tone ?? CaptionTone.Friendly;
    const prompt = dto.prompt.trim();

    const system =
      'You write high-quality social media captions. Return only valid JSON which matches the schema.';
    const userPrompt = `Generate ${count} caption suggestion(s) for this post. Tone: ${tone}.\n\nPost:\n${prompt}`;

    const body = {
      model,
      store: false,
      safety_identifier: hashSafetyIdentifier(user.userId),
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: system }],
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: userPrompt }],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'caption_suggestions',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              suggestions: {
                type: 'array',
                items: { type: 'string' },
                minItems: 1,
                maxItems: 5,
              },
            },
            required: ['suggestions'],
          },
        },
      },
    };

    let resp: Response;
    try {
      resp = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (err: unknown) {
      throw new BadGatewayException(
        err instanceof Error ? err.message : 'Failed to reach AI provider',
      );
    }

    const payload = (await resp.json().catch(() => null)) as unknown;
    if (!resp.ok) {
      const maybeMessage =
        (payload as { error?: { message?: unknown } } | null)?.error?.message ??
        undefined;
      const message =
        typeof maybeMessage === 'string' && maybeMessage.length
          ? maybeMessage
          : 'AI request failed';

      if (resp.status === 401) {
        throw new ServiceUnavailableException(
          'AI is misconfigured (invalid OPENAI_API_KEY)',
        );
      }

      if (
        resp.status === 429 ||
        message.toLowerCase().includes('quota') ||
        message.toLowerCase().includes('billing')
      ) {
        throw new ServiceUnavailableException(
          'AI is temporarily unavailable (quota/billing)',
        );
      }

      throw new BadGatewayException(message);
    }

    const text = extractFirstOutputText(payload);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new BadGatewayException('AI returned non-JSON output');
    }

    const suggestions = (parsed as { suggestions?: unknown }).suggestions;
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      throw new BadGatewayException(
        'AI returned an invalid suggestions payload',
      );
    }

    const cleaned = suggestions
      .filter((s): s is string => typeof s === 'string')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, 5);

    if (cleaned.length === 0) {
      throw new BadGatewayException('AI returned empty suggestions');
    }

    return { suggestions: cleaned };
  }
}
