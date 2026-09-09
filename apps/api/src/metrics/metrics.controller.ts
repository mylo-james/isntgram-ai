import { Controller, Get, NotFoundException, Res } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { MetricsService } from './metrics.service';

@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @ApiOkResponse({ description: 'Prometheus metrics exposition' })
  async getMetrics(@Res() res: Response) {
    if (!this.metricsService.isEnabled()) {
      throw new NotFoundException('Metrics disabled');
    }

    const metrics = await this.metricsService.getMetrics();
    res.setHeader('Content-Type', this.metricsService.getContentType());
    res.send(metrics);
  }
}
