import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { MediaUpload } from './entities/media-upload.entity';
import { AdmissionModule } from '../common/admission/admission.module';

@Module({
  imports: [TypeOrmModule.forFeature([MediaUpload]), AdmissionModule],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
