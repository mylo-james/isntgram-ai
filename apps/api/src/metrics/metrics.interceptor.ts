import { Injectable, type NestInterceptor } from '@nestjs/common';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';
import { finalize } from 'rxjs/operators';
import { getRouteLabel } from '../common/http/route-label';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    if (!this.metricsService.isEnabled()) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    if ((req.originalUrl || req.url).startsWith('/api/metrics')) {
      return next.handle();
    }

    const endTimer = this.metricsService.startTimer();
    this.metricsService.incrementInFlight();

    const labels = {
      method: req.method,
      route: getRouteLabel(req),
      status_code: '0',
    } as const;

    return next.handle().pipe(
      finalize(() => {
        this.metricsService.decrementInFlight();
        this.metricsService.recordRequest(
          {
            ...labels,
            status_code: String(res.statusCode),
          },
          endTimer,
        );
      }),
    );
  }
}
