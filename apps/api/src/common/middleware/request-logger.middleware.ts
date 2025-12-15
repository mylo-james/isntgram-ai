import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export interface RequestLoggerOptions {
  nodeEnv: string;
  service?: string;
  projectId?: string;
}

export function createRequestLoggerMiddleware(options: RequestLoggerOptions) {
  const service = options.service ?? 'api';
  const projectId = options.projectId;

  return (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();

    const incomingRequestId = req.header('x-request-id') || undefined;
    const requestId =
      incomingRequestId && incomingRequestId.length <= 256
        ? incomingRequestId
        : crypto.randomUUID();

    res.setHeader('x-request-id', requestId);
    (req as unknown as { requestId?: string }).requestId = requestId;

    const traceHeader = req.header('x-cloud-trace-context') || undefined;
    const traceId = traceHeader ? traceHeader.split('/')[0] : undefined;

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      const path = (req.originalUrl || req.url || '').split('?')[0];

      const severity =
        res.statusCode >= 500
          ? 'ERROR'
          : res.statusCode >= 400
            ? 'WARNING'
            : 'INFO';

      const log: Record<string, unknown> = {
        severity,
        message: `${req.method} ${path} ${res.statusCode} ${durationMs.toFixed(
          1,
        )}ms`,
        service,
        requestId,
        httpRequest: {
          requestMethod: req.method,
          requestUrl: path,
          status: res.statusCode,
          userAgent: req.header('user-agent') || undefined,
          latency: `${durationMs.toFixed(3)}ms`,
        },
      };

      // If running on Google Cloud, this links logs to Cloud Trace.
      if (projectId && traceId) {
        log['logging.googleapis.com/trace'] =
          `projects/${projectId}/traces/${traceId}`;
      }

      // eslint-disable-next-line no-console
      console.log(JSON.stringify(log));
    });

    next();
  };
}
