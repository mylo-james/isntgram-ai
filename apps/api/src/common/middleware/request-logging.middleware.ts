import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const nodeEnv = this.configService.get('NODE_ENV', 'development');
    const enabled =
      this.configService.get('REQUEST_LOGGING', 'true') !== 'false';

    if (!enabled || nodeEnv === 'test') {
      return next();
    }

    const start = process.hrtime.bigint();
    res.on('finish', () => {
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
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        route: this.getRouteLabel(req),
        statusCode: res.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
        contentLength: Number.isFinite(contentLength)
          ? contentLength
          : undefined,
        userAgent: req.headers['user-agent'],
        referer: req.headers.referer,
        ip: req.ip,
      };
      if (res.statusCode >= 500) {
        this.logger.error(JSON.stringify(payload));
      } else if (res.statusCode >= 400) {
        this.logger.warn(JSON.stringify(payload));
      } else {
        this.logger.log(JSON.stringify(payload));
      }
    });

    return next();
  }

  private getRouteLabel(req: Request): string {
    const baseUrl = req.baseUrl ?? '';
    const routePath = req.route?.path ?? '';
    let route = `${baseUrl}${routePath}`;
    if (!route) {
      return 'unmatched';
    }
    if (route.endsWith('/') && route !== '/') {
      route = route.slice(0, -1);
    }
    return route;
  }
}
