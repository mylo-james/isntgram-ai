import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
  Gauge,
} from 'prom-client';

const METRICS_PREFIX = 'isntgram_api_';

type RequestMetricLabelName = 'method' | 'route' | 'status_code';
type RequestMetricLabels = Record<RequestMetricLabelName, string>;

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();
  private readonly enabled: boolean;
  private readonly httpRequestsTotal?: Counter<RequestMetricLabelName>;
  private readonly httpRequestDuration?: Histogram<RequestMetricLabelName>;
  private readonly httpRequestsInFlight?: Gauge;

  constructor(private readonly configService: ConfigService) {
    const nodeEnv = this.configService.get('NODE_ENV', 'development');
    this.enabled =
      this.configService.get('METRICS_ENABLED', 'true') !== 'false' &&
      nodeEnv !== 'test';

    if (!this.enabled) {
      return;
    }

    this.registry.setDefaultLabels({
      service: 'isntgram-api',
      env: nodeEnv,
    });

    collectDefaultMetrics({
      register: this.registry,
      prefix: METRICS_PREFIX,
    });

    this.httpRequestsTotal = new Counter({
      name: `${METRICS_PREFIX}http_requests_total`,
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: `${METRICS_PREFIX}http_request_duration_seconds`,
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    });

    this.httpRequestsInFlight = new Gauge({
      name: `${METRICS_PREFIX}http_requests_in_flight`,
      help: 'Number of HTTP requests currently in flight',
      registers: [this.registry],
    });
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getContentType(): string {
    return this.registry.contentType;
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  incrementInFlight() {
    if (!this.enabled || !this.httpRequestsInFlight) return;
    this.httpRequestsInFlight.inc();
  }

  decrementInFlight() {
    if (!this.enabled || !this.httpRequestsInFlight) return;
    this.httpRequestsInFlight.dec();
  }

  startTimer(): ((labels: RequestMetricLabels) => void) | undefined {
    if (!this.enabled || !this.httpRequestDuration) return undefined;
    return this.httpRequestDuration.startTimer();
  }

  recordRequest(
    labels: RequestMetricLabels,
    endTimer?: (labels: RequestMetricLabels) => void,
  ) {
    if (!this.enabled || !this.httpRequestsTotal || !this.httpRequestDuration) {
      return;
    }
    this.httpRequestsTotal.inc(labels);
    if (endTimer) {
      endTimer(labels);
    }
  }
}
