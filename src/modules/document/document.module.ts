import { Module, forwardRef } from '@nestjs/common';
import { DocFolderController } from './controllers/doc-folder.controller';
import { DocFileController } from './controllers/doc-file.controller';
import { DocFolderService } from './services/doc-folder.service';
import { DocFileService } from './services/doc-file.service';
import { StorageModule } from '../../modules/sys/storage/storage.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { AiQuotasModule } from  '../int/ai-quotas/ai-quotas.module'   

@Module({
  imports: [
    StorageModule, 
    // นำเข้า Workflow แบบ forwardRef ป้องกันงูกินหางระหว่าง Document กับ Workflow
    forwardRef(() => WorkflowModule),
    AiQuotasModule // 🌟 2. เพิ่มเข้าใน imports เพื่อให้พร้อมใช้งาน
  ],
  controllers: [DocFolderController, DocFileController],
  providers: [DocFolderService, DocFileService],
  // สำคัญมาก! ต้อง Export DocFileService ออกไปให้ WfRequestService หยิบไปใช้ได้
  exports: [DocFileService] 
})
export class DocumentModule {}