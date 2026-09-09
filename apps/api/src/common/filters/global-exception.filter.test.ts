import { Test, TestingModule } from '@nestjs/testing';
import {
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockHost: ArgumentsHost;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GlobalExceptionFilter],
    }).compile();

    filter = module.get<GlobalExceptionFilter>(GlobalExceptionFilter);

    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({}),
        getResponse: jest.fn().mockReturnValue({
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis(),
        }),
      }),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as ArgumentsHost;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  it('should handle HttpException', () => {
    const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);
    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    jest.spyOn(mockHost, 'switchToHttp').mockReturnValue({
      getRequest: jest.fn().mockReturnValue({}),
      getResponse: jest.fn().mockReturnValue(mockResponse),
    } as any);

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Test error',
        error: 'HttpException',
        timestamp: expect.any(String),
        path: undefined,
      }),
    );
  });

  it('should handle generic Error', () => {
    const exception = new Error('Generic error');
    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    jest.spyOn(mockHost, 'switchToHttp').mockReturnValue({
      getRequest: jest.fn().mockReturnValue({}),
      getResponse: jest.fn().mockReturnValue(mockResponse),
    } as any);

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Generic error',
        error: 'Error',
        timestamp: expect.any(String),
        path: undefined,
      }),
    );
  });

  it('should handle unknown exceptions', () => {
    const exception = 'Unknown error';
    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    jest.spyOn(mockHost, 'switchToHttp').mockReturnValue({
      getRequest: jest.fn().mockReturnValue({}),
      getResponse: jest.fn().mockReturnValue(mockResponse),
    } as any);

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        error: 'InternalServerError',
        timestamp: expect.any(String),
        path: undefined,
      }),
    );
  });

  it('should hide generic errors in production', () => {
    process.env.NODE_ENV = 'production';
    const exception = new Error('Sensitive error');
    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    jest.spyOn(mockHost, 'switchToHttp').mockReturnValue({
      getRequest: jest.fn().mockReturnValue({}),
      getResponse: jest.fn().mockReturnValue(mockResponse),
    } as any);

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        error: 'InternalServerError',
      }),
    );
  });

  it('emits one safe final record for a guard-style rejection without changing the response request ID', () => {
    const loggerWarn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation();
    const loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation();
    const rawRequestId = 'unsafe-id?token=secret-value';
    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    jest.spyOn(mockHost, 'switchToHttp').mockReturnValue({
      getRequest: jest.fn().mockReturnValue({
        requestId: rawRequestId,
        method: 'GET',
        url: '/api/private?token=secret-value',
        originalUrl: '/api/private?token=secret-value',
        baseUrl: '',
        route: undefined,
        headers: { authorization: 'Bearer secret-value' },
      }),
      getResponse: jest.fn().mockReturnValue(mockResponse),
    } as any);

    filter.catch(
      new HttpException('Forbidden', HttpStatus.FORBIDDEN),
      mockHost,
    );

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: rawRequestId,
        statusCode: HttpStatus.FORBIDDEN,
      }),
    );
    expect(loggerWarn).toHaveBeenCalledTimes(1);
    expect(loggerError).not.toHaveBeenCalled();
    const payload = String(loggerWarn.mock.calls[0]?.[0]);
    expect(payload).toContain('"route":"unmatched"');
    expect(payload).toContain('"statusCode":403');
    expect(payload).not.toContain(rawRequestId);
    expect(payload).not.toContain('secret-value');
    expect(payload).not.toContain('authorization');
  });

  it('preserves a valid UUID in the final handler-error record and does not log exception text', () => {
    const loggerWarn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation();
    const loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation();
    const requestId = '6d6a4c21-5b6e-4e50-9d86-0d66d2b9f0cc';
    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    jest.spyOn(mockHost, 'switchToHttp').mockReturnValue({
      getRequest: jest.fn().mockReturnValue({
        requestId,
        method: 'POST',
        url: '/api/users/secret-user?token=secret-value',
        baseUrl: '/api',
        route: { path: '/users/:username' },
      }),
      getResponse: jest.fn().mockReturnValue(mockResponse),
    } as any);

    filter.catch(new Error('database password secret-value'), mockHost);

    expect(loggerError).toHaveBeenCalledTimes(1);
    expect(loggerWarn).not.toHaveBeenCalled();
    const payload = String(loggerError.mock.calls[0]?.[0]);
    expect(payload).toContain(requestId);
    expect(payload).toContain('"route":"/api/users/:username"');
    expect(payload).not.toContain('secret-value');
    expect(payload).not.toContain('database password');
  });
});
