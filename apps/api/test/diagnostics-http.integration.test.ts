import {
  CanActivate,
  Controller,
  ExecutionContext,
  ForbiddenException,
  Get,
  Logger,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { HttpLoggingInterceptor } from '../src/common/interceptors/http-logging.interceptor';
import { RequestIdMiddleware } from '../src/common/middleware/request-id.middleware';

const unsafeRequestId = 'external-id?token=not-for-log';

@Controller('diagnostics-proof')
class DiagnosticsProofController {
  @Get('guard-failure')
  guardFailure(): { ok: true } {
    return { ok: true };
  }

  @Get('handler-failure')
  handlerFailure(): never {
    throw new Error('handler token must not reach diagnostics');
  }
}

class DiagnosticsProofGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ path: string }>();
    if (request.path === '/diagnostics-proof/guard-failure') {
      throw new ForbiddenException('guard token must not reach diagnostics');
    }
    return true;
  }
}

const configService = {
  get: (key: string, fallback?: string) => {
    if (key === 'NODE_ENV') return 'production';
    if (key === 'REQUEST_LOGGING') return 'true';
    return fallback;
  },
};

describe('diagnostics HTTP proof', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [DiagnosticsProofController],
    }).compile();

    app = module.createNestApplication();
    app.use(new RequestIdMiddleware().use.bind(new RequestIdMiddleware()));
    app.useGlobalGuards(new DiagnosticsProofGuard());
    app.useGlobalFilters(new GlobalExceptionFilter(configService as never));
    app.useGlobalInterceptors(
      new HttpLoggingInterceptor(configService as never),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('emits one safe warning for a guard rejection before the interceptor', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const success = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    const response = await request(app.getHttpServer())
      .get('/diagnostics-proof/guard-failure?token=not-for-log')
      .set('Authorization', 'Bearer token-not-for-log')
      .set('x-request-id', unsafeRequestId)
      .expect(403);

    expect(response.headers['x-request-id']).toBe(unsafeRequestId);
    expect(response.body).toEqual(
      expect.objectContaining({ requestId: unsafeRequestId, statusCode: 403 }),
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
    const payload = String(warn.mock.calls[0]?.[0]);
    expect(payload).toContain('"route":"/diagnostics-proof/guard-failure"');
    expect(payload).toContain('"statusCode":403');
    expect(payload).not.toContain('not-for-log');
    expect(payload).not.toContain('Authorization');
  });

  it('emits one safe final error for a handler failure', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const success = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    const response = await request(app.getHttpServer())
      .get('/diagnostics-proof/handler-failure?token=not-for-log')
      .set('Authorization', 'Bearer token-not-for-log')
      .set('x-request-id', unsafeRequestId)
      .expect(500);

    expect(response.headers['x-request-id']).toBe(unsafeRequestId);
    expect(response.body).toEqual(
      expect.objectContaining({ requestId: unsafeRequestId, statusCode: 500 }),
    );
    expect(error).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
    const payload = String(error.mock.calls[0]?.[0]);
    expect(payload).toContain('"route":"/diagnostics-proof/handler-failure"');
    expect(payload).toContain('"statusCode":500');
    expect(payload).not.toContain('not-for-log');
    expect(payload).not.toContain('Authorization');
    expect(payload).not.toContain('handler token');
  });
});
