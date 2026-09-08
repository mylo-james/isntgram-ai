import { Injectable, Logger, type NestInterceptor } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';
import { tap } from 'rxjs/operators';
import { getRouteLabel } from '../http/route-label';
import { normalizeRequestIdForLog } from '../middleware/request-id.middleware';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly configService: ConfigService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const nodeEnv = this.configService.get('NODE_ENV', 'development');
    const enabled =
      this.configService.get('REQUEST_LOGGING', 'true') !== 'false';

    if (!enabled || nodeEnv === 'test') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    if ((req.originalUrl || req.url).startsWith('/api/metrics')) {
      return next.handle();
    }

    const start = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        complete: () => {
          if (res.statusCode >= 400) return;
          const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
          const contentLengthHeader = res.getHeader('content-length');
          const contentLength =
            typeof contentLengthHeader === 'number'
              ? contentLengthHeader
              : typeof contentLengthHeader === 'string'
                ? Number(contentLengthHeader)
                : Array.isArray(contentLengthHeader)
                  ? Number(contentLengthHeader[0])
                  : undefined;

          const payload = {
            requestId: normalizeRequestIdForLog(req.requestId),
            method: req.method,
            route: getRouteLabel(req),
            statusCode: res.statusCode,
            durationMs: Number(durationMs.toFixed(2)),
            contentLength: Number.isFinite(contentLength)
              ? contentLength
              : undefined,
          };

          this.logger.log(JSON.stringify(payload));
        },
      }),
    );
  }
}
