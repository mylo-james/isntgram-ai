import { MetricsService } from './metrics.service';
import type { ConfigService } from '@nestjs/config';

function config(values: Record<string, string | undefined>) {
  return {
    get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback),
  } as unknown as ConfigService;
}

describe('MetricsService', () => {
  it.each([
    { NODE_ENV: 'test' },
    { NODE_ENV: 'development', METRICS_ENABLED: 'false' },
  ])(
    'does not publish request instruments when disabled by %#',
    async (values) => {
      const service = new MetricsService(config(values));
      expect(service.isEnabled()).toBe(false);
      expect(service.startTimer()).toBeUndefined();
      service.incrementInFlight();
      service.decrementInFlight();
      service.recordRequest({
        method: 'GET',
        route: '/api/feed',
        status_code: '200',
      });
      await expect(service.getMetrics()).resolves.toMatch(/^\s*$/);
    },
  );

  it('publishes labeled request, duration, and balanced in-flight results when enabled', async () => {
    const service = new MetricsService(
      config({ NODE_ENV: 'development', METRICS_ENABLED: 'true' }),
    );
    const endTimer = service.startTimer();
    expect(endTimer).toEqual(expect.any(Function));

    service.incrementInFlight();
    service.decrementInFlight();
    service.recordRequest(
      { method: 'GET', route: '/api/feed', status_code: '200' },
      endTimer,
    );

    const metrics = await service.getMetrics();
    expect(service.isEnabled()).toBe(true);
    expect(service.getContentType()).toContain('text/plain');
    expect(metrics).toMatch(
      /isntgram_api_http_requests_total\{[^}]*method="GET"[^}]*route="\/api\/feed"[^}]*status_code="200"[^}]*\} 1/,
    );
    expect(metrics).toMatch(
      /isntgram_api_http_request_duration_seconds_count\{[^}]*method="GET"[^}]*route="\/api\/feed"[^}]*status_code="200"[^}]*\} 1/,
    );
    expect(metrics).toMatch(/isntgram_api_http_requests_in_flight\{[^}]*\} 0/);
  });
});
