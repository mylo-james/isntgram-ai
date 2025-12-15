import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/node';

interface ExceptionResponse {
  message?: unknown;
  error?: unknown;
}

function normalizeErrorMessage(message: unknown, fallback: string): string {
  if (typeof message === 'string' && message.trim().length) return message;

  if (Array.isArray(message)) {
    const parts = message
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length);

    if (parts.length) return parts.join('; ');
  }

  return fallback || 'An error occurred';
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = (request as unknown as { requestId?: string }).requestId;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'InternalServerError';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as ExceptionResponse;
        message = normalizeErrorMessage(responseObj.message, exception.message);
        error =
          typeof responseObj.error === 'string'
            ? responseObj.error
            : exception.name;
      } else {
        message = exception.message;
        error = exception.name;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.name;
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      error,
      requestId,
    };

    const nodeEnv = process.env.NODE_ENV;
    if (
      process.env.SENTRY_DSN &&
      nodeEnv !== 'test' &&
      status >= HttpStatus.INTERNAL_SERVER_ERROR
    ) {
      Sentry.withScope((scope) => {
        scope.setTag('service', 'api');
        scope.setTag('http.method', request.method);
        scope.setTag('http.path', request.path);
        if (requestId) scope.setTag('request.id', requestId);
        scope.setExtra('url', request.url);
        scope.setExtra('statusCode', status);

        const maybeUser = (request as unknown as { user?: unknown }).user as
          | { userId?: string; username?: string }
          | undefined;
        if (maybeUser?.userId) {
          scope.setUser({ id: maybeUser.userId, username: maybeUser.username });
        }

        Sentry.captureException(
          exception instanceof Error ? exception : new Error(message),
        );
      });
    }

    if (nodeEnv !== 'test') {
      const summary = `${request.method} ${request.url} ${status} - ${message}`;
      if (status >= 500) {
        this.logger.error(
          summary,
          exception instanceof Error ? exception.stack : undefined,
        );
      } else if (nodeEnv !== 'production') {
        this.logger.warn(summary);
      }
    }

    response.status(status).json(errorResponse);
  }
}
