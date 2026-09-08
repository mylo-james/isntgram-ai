import { NotFoundException } from '@nestjs/common';
import type { Response } from 'express';

import { MetricsController } from './metrics.controller';
import type { MetricsService } from './metrics.service';

describe('MetricsController', () => {
  const service = {
    isEnabled: jest.fn(),
    getMetrics: jest.fn(),
    getContentType: jest.fn(),
  };
  const response = { setHeader: jest.fn(), send: jest.fn() };
  beforeEach(() => jest.clearAllMocks());

  it('refuses exposition before reading it when metrics are disabled', async () => {
    service.isEnabled.mockReturnValue(false);
    await expect(
      new MetricsController(service as unknown as MetricsService).getMetrics(
        response as unknown as Response,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(service.getMetrics).not.toHaveBeenCalled();
  });

  it('sends public metrics with its advertised content type when enabled', async () => {
    service.isEnabled.mockReturnValue(true);
    service.getMetrics.mockResolvedValue('metric 1\n');
    service.getContentType.mockReturnValue('text/plain');
    await new MetricsController(
      service as unknown as MetricsService,
    ).getMetrics(response as unknown as Response);
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/plain',
    );
    expect(response.send).toHaveBeenCalledWith('metric 1\n');
  });
});
