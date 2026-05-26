import { Module, forwardRef } from '@nestjs/common';
import { WfRequestController } from './wf-request.controller';
import { WfRequestService } from './wf-request.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { WfActionModule } from '../actions/wf-action.module';
import { DocumentModule } from '../../document/document.module';
import { ManpowerRequestModule } from '../../hr/manpower-requests/manpower-request.module';
import { OrgStructureVersionModule } from '../../hr/org-structure-version/org-structure-version.module';  
import { ReturnRequestsModule } from '../../com/return-requests/return-requests.module';
import { RedemptionsModule } from '../../crm/redemptions/redemptions.module';
// 🌟 [NEW] Import โมดูลระบบจัดซื้อเข้ามาเชื่อมต่อกับแกนกลาง Workflow
import { PurchaseOrdersModule } from '../../pro/purchase-orders/purchase-orders.module';
import { TrainingModule } from '../../hr/training/training.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => WfActionModule),
    forwardRef(() => DocumentModule),
    forwardRef(() => ManpowerRequestModule),
    forwardRef(() => OrgStructureVersionModule), 
    forwardRef(() => ReturnRequestsModule), 
    forwardRef(() => RedemptionsModule), 
    
    // 🛡️ [เพิ่มใหม่] ป้องกันงูกินหางระดับโมดูลข้ามเครือข่าย PRO (จัดซื้อ)
    forwardRef(() => PurchaseOrdersModule), // 👈 ใส่เกราะป้องกันไว้ ปลอดภัยที่สุดครับ
    forwardRef(() => TrainingModule),
  ],
  controllers: [WfRequestController],
  providers: [WfRequestService],
  exports: [WfRequestService],
})
export class WfRequestModule {}