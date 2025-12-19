import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    if (!this.metricsService.isEnabled()) {
      return next();
    }

    const endTimer = this.metricsService.startTimer();
    this.metricsService.incrementInFlight();

    let finalized = false;
    const finalize = () => {
      if (finalized) return;
      finalized = true;

      this.metricsService.decrementInFlight();

      const route = this.getRouteLabel(req);
      if (route === '/api/metrics') {
        return;
      }

      this.metricsService.recordRequest(
        {
          method: req.method,
          route,
          status_code: String(res.statusCode),
        },
        endTimer,
      );
    };

    res.on('finish', finalize);
    res.on('close', finalize);

    return next();
  }

  private getRouteLabel(req: Request): string {
    const baseUrl = req.baseUrl ?? '';
    const routePath = req.route?.path ?? '';
    let route = `${baseUrl}${routePath}`;
    if (!route) {
      return 'unmatched';
    }
    if (route.endsWith('/') && route !== '/') {
      route = route.slice(0, -1);
    }
    return route;
  }
}
