import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_LOG_REQUEST_ID_LENGTH = 128;

export function normalizeRequestIdForLog(requestId: unknown): string {
  if (typeof requestId !== 'string') return 'missing';
  if (UUID_PATTERN.test(requestId)) return requestId;

  const bounded = requestId.slice(0, MAX_LOG_REQUEST_ID_LENGTH);
  return bounded.length > 0
    ? `invalid:${Buffer.from(bounded).toString('base64url')}`
    : 'missing';
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.headers['x-request-id'];
    const requestId =
      typeof incoming === 'string' && incoming.length > 0
        ? incoming
        : randomUUID();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  }
}
