import { Logger } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { HttpLoggingInterceptor } from './http-logging.interceptor';

describe('HttpLoggingInterceptor', () => {
  const configService = {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'NODE_ENV') return 'development';
      if (key === 'REQUEST_LOGGING') return 'true';
      return fallback;
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function contextFor(requestId: string, statusCode = 200) {
    const request = {
      requestId,
      method: 'GET',
      url: '/api/users/secret-user?token=secret-value',
      originalUrl: '/api/users/secret-user?token=secret-value',
      baseUrl: '/api',
      route: { path: '/users/:username' },
      headers: { authorization: 'Bearer secret-value' },
    };
    const response = {
      statusCode,
      getHeader: jest.fn().mockReturnValue(10),
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as any;
  }

  it('logs successful completions through the safe route boundary', (done) => {
    const loggerLog = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const interceptor = new HttpLoggingInterceptor(configService as any);

    interceptor
      .intercept(contextFor('not-a-uuid?token=secret-value'), {
        handle: () => of({ ok: true }),
      } as any)
      .subscribe({
        complete: () => {
          expect(loggerLog).toHaveBeenCalledTimes(1);
          const payload = String(loggerLog.mock.calls[0]?.[0]);
          expect(payload).toContain('"route":"/api/users/:username"');
          expect(payload).not.toContain('secret-value');
          expect(payload).not.toContain('authorization');
          done();
        },
      });
  });

  it('does not emit a second log when a handler errors', (done) => {
    const loggerLog = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const loggerWarn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation();
    const loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation();
    const interceptor = new HttpLoggingInterceptor(configService as any);

    interceptor
      .intercept(contextFor('6d6a4c21-5b6e-4e50-9d86-0d66d2b9f0cc', 500), {
        handle: () => throwError(() => new Error('handler failure')),
      } as any)
      .subscribe({
        error: () => {
          expect(loggerLog).not.toHaveBeenCalled();
          expect(loggerWarn).not.toHaveBeenCalled();
          expect(loggerError).not.toHaveBeenCalled();
          done();
        },
      });
  });
});
