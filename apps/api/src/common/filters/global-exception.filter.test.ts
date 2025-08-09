import { Test, TestingModule } from '@nestjs/testing';
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockHost: ArgumentsHost;

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

  it('should be defined', () => {
    expect(filter).toBeDefined();
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
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Test error',
      error: 'HttpException',
      timestamp: expect.any(String),
      path: undefined,
    });
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
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Generic error',
      error: 'Error',
      timestamp: expect.any(String),
      path: undefined,
    });
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
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'InternalServerError',
      timestamp: expect.any(String),
      path: undefined,
    });
  });
});
