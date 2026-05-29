import { Module, Global, forwardRef } from '@nestjs/common'; 
import { WorkflowDefinitionModule } from './definitions/workflow-definition.module';
import { WfNodeModule } from './nodes/wf-node.module';
import { WfRequestModule } from './requests/wf-request.module';
import { WfActionModule } from './actions/wf-action.module';
import { WorkflowSchedulerService } from './schedulers/workflow-scheduler.service';
import { WorkflowService } from './workflow.service'; 
import { PrismaModule } from '../../prisma/prisma.module';
import { WorkflowController } from './workflow.controller';

@Global() 
@Module({
  imports: [
    PrismaModule,
    WorkflowDefinitionModule,
    WfNodeModule,
    // 🌟 ใช้ forwardRef ป้องกันงูกินหางระดับ Root
    forwardRef(() => WfRequestModule), 
    forwardRef(() => WfActionModule),  
  ],
  controllers: [
    WorkflowController 
  ],
  providers: [
    WorkflowSchedulerService,
    WorkflowService,
  ],
  exports: [
    WorkflowService, 
    WorkflowDefinitionModule,
    WfNodeModule,
    WfRequestModule,
    WfActionModule,
  ]
})
export class WorkflowModule {}