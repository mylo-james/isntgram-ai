import { Module } from '@nestjs/common';
import { DemoReadOnlyGuard } from './guards/demo-readonly.guard';

@Module({
  providers: [DemoReadOnlyGuard],
  exports: [DemoReadOnlyGuard],
})
export class CommonModule {}
