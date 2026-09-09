import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdmissionService } from './admission.service';
import { AdmissionGuard } from './admission.guard';

@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [AdmissionService, AdmissionGuard],
  exports: [AdmissionService, AdmissionGuard],
})
export class AdmissionModule {}
