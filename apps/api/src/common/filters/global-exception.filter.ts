import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { getRouteLabel } from '../http/route-label';
import { normalizeRequestIdForLog } from '../middleware/request-id.middleware';

interface ExceptionResponse {
  message?: unknown;
  error?: unknown;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  constructor(@Optional() private readonly configService?: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const nodeEnv =
      this.configService?.get<string>('NODE_ENV') ??
      process.env.NODE_ENV ??
      'development';
    const isProduction = nodeEnv === 'production';
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'InternalServerError';
    let errors: string[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as ExceptionResponse;
        const rawMessage = responseObj.message;
        if (Array.isArray(rawMessage)) {
          errors = rawMessage
            .filter((entry): entry is string => typeof entry === 'string')
            .map((entry) => entry.trim())
            .filter(Boolean);
          message = errors[0] || exception.message;
        } else if (
          typeof rawMessage === 'string' &&
          rawMessage.trim().length > 0
        ) {
          message = rawMessage;
        } else {
          message = exception.message;
        }

        const rawError = responseObj.error;
        error =
          typeof rawError === 'string' && rawError.trim().length > 0
            ? rawError
            : exception.name;
      } else {
        message = exception.message;
        error = exception.name;
      }
    } else if (exception instanceof Error) {
      if (!isProduction) {
        message = exception.message;
        error = exception.name;
      }
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: request.requestId,
      message,
      errors,
      error,
    };

    response.status(status);

    const payload = {
      requestId: normalizeRequestIdForLog(request.requestId),
      method: request.method,
      route: getRouteLabel(request),
      statusCode: status,
    };
    const serializedPayload = JSON.stringify(payload);
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(serializedPayload);
    } else {
      this.logger.warn(serializedPayload);
    }

    response.json(errorResponse);
  }
}
