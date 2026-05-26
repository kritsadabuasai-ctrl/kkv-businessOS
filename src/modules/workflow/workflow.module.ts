import { Module, Global } from '@nestjs/common'; 
import { WorkflowDefinitionModule } from './definitions/workflow-definition.module';
import { WfNodeModule } from './nodes/wf-node.module';
import { WfRequestModule } from './requests/wf-request.module';
import { WfActionModule } from './actions/wf-action.module';
import { WorkflowSchedulerService } from './schedulers/workflow-scheduler.service';
import { WorkflowService } from './workflow.service'; 
import { PrismaModule } from '../../prisma/prisma.module';
import { WorkflowController } from './workflow.controller';

@Global() // 🌟 ทำให้โมดูลอื่นเรียกใช้ WorkflowService ได้ทั่วทั้งแอปโดยไม่ต้อง import ซ้ำ
@Module({
  imports: [
    PrismaModule,
    WorkflowDefinitionModule, // จัดการโครงสร้างสายอนุมัติ[cite: 21, 22]
    WfNodeModule,              // จัดการโหนดใน Workflow[cite: 20, 22]
    WfRequestModule,           // จัดการคำร้อง (หัวใจหลักที่เชื่อมกับ Document)[cite: 17, 22]
    WfActionModule,            // จัดการการกดอนุมัติ/ไม่อนุมัติ[cite: 16, 22]
  ],
  controllers: [
    WorkflowController 
  ],
  providers: [
    WorkflowSchedulerService,
    WorkflowService,           // Service กลางสำหรับประมวลผลลอจิก Workflow[cite: 22]
  ],
  exports: [
    // 🌟 ส่งออกเพื่อให้โมดูลอื่น (เช่น DocumentModule) สามารถเรียกใช้ Service และโมดูลย่อยได้
    WorkflowService, 
    WorkflowDefinitionModule,
    WfNodeModule,
    WfRequestModule,
    WfActionModule,
  ]
})
export class WorkflowModule {}