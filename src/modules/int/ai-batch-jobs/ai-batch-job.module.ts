import { Module } from '@nestjs/common';
import { AiBatchJobController } from './ai-batch-job.controller';
import { AiBatchJobService } from './ai-batch-job.service';
import { AiBatchWorkerService } from './ai-batch-worker.service';

// ✅ 1. Import Modules ที่เราเรียกใช้ใน Service เข้ามา
import { FileParserModule } from '../file-parser/file-parser.module';
import { UploadModule } from '../upload/upload.module';
import { GoogleDriveModule } from '../google-drive/google-drive.module';

@Module({
  // ✅ 2. เอา Modules มาใส่ใน Array imports
  imports: [
    FileParserModule,
    UploadModule,
    GoogleDriveModule
  ],
  controllers: [AiBatchJobController],
  providers: [AiBatchJobService, AiBatchWorkerService],
  exports: [AiBatchJobService],
})
export class AiBatchJobModule {}