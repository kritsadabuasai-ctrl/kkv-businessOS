import { Module } from '@nestjs/common';
import { KnowledgeBaseService } from './knowledge-base.service';
import { KnowledgeBaseController } from './knowledge-base.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { GoogleDriveModule } from '../google-drive/google-drive.module';
import { FileParserModule } from '../file-parser/file-parser.module';
import { UploadModule } from '../upload/upload.module'; // ✅ เพิ่มการ Import

@Module({
  imports: [
    PrismaModule,
    UploadModule,      // ✅ เพิ่มเพื่อให้รู้จัก UploadService
    GoogleDriveModule, // ✅ จำเป็นต้องมีเพื่อรู้จัก GoogleDriveService
    FileParserModule,  // ✅ จำเป็นต้องมีเพื่อรู้จัก FileParserService
  ],
  controllers: [KnowledgeBaseController],
  providers: [KnowledgeBaseService],
  exports: [KnowledgeBaseService],
})
export class KnowledgeBaseModule {}