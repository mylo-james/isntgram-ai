import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ExceptionResponse {
  message?: unknown;
  error?: unknown;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isProduction = process.env.NODE_ENV === 'production';
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

    response.status(status).json(errorResponse);
  }
}
