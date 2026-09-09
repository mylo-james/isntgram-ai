import { of } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { MetricsInterceptor } from './metrics.interceptor';
import type { MetricsService } from './metrics.service';

describe('MetricsInterceptor', () => {
  const metrics = {
    isEnabled: jest.fn(),
    startTimer: jest.fn(),
    incrementInFlight: jest.fn(),
    decrementInFlight: jest.fn(),
    recordRequest: jest.fn(),
  };
  const next = { handle: jest.fn(() => of('done')) };
  const context = (url: string) => ({
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'GET',
        originalUrl: url,
        baseUrl: '/api',
        route: { path: '/feed' },
      }),
      getResponse: () => ({ statusCode: 201 }),
    }),
  });
  beforeEach(() => jest.clearAllMocks());

  it('bypasses disabled traffic and the metrics endpoint', () => {
    metrics.isEnabled.mockReturnValueOnce(false).mockReturnValueOnce(true);
    new MetricsInterceptor(metrics as unknown as MetricsService)
      .intercept(
        context('/api/feed') as unknown as ExecutionContext,
        next as unknown as CallHandler,
      )
      .subscribe();
    new MetricsInterceptor(metrics as unknown as MetricsService)
      .intercept(
        context('/api/metrics') as unknown as ExecutionContext,
        next as unknown as CallHandler,
      )
      .subscribe();
    expect(metrics.incrementInFlight).not.toHaveBeenCalled();
    expect(metrics.recordRequest).not.toHaveBeenCalled();
  });

  it('balances ordinary request instrumentation with final labels', () => {
    metrics.isEnabled.mockReturnValue(true);
    const timer = jest.fn();
    metrics.startTimer.mockReturnValue(timer);
    new MetricsInterceptor(metrics as unknown as MetricsService)
      .intercept(
        context('/api/feed?page=1') as unknown as ExecutionContext,
        next as unknown as CallHandler,
      )
      .subscribe();
    expect(metrics.incrementInFlight).toHaveBeenCalledTimes(1);
    expect(metrics.decrementInFlight).toHaveBeenCalledTimes(1);
    expect(metrics.recordRequest).toHaveBeenCalledWith(
      { method: 'GET', route: '/api/feed', status_code: '201' },
      timer,
    );
  });
});
