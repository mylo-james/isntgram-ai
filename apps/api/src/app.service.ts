import { Injectable, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AppService {
  constructor(@Optional() private readonly dataSource?: DataSource) {}

  getHello(): string {
    return 'Isntgram API';
  }

  async getReadiness(): Promise<{ status: string; database: string }> {
    if (!this.dataSource) {
      return { status: 'ok', database: 'skipped' };
    }

    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', database: 'connected' };
    } catch {
      return { status: 'degraded', database: 'disconnected' };
    }
  }
}
