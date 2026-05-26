import { Module, forwardRef } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { OrdersModule } from '../../com/orders/orders.module'; 
import { RunningNumbersModule } from '../../cfg/running-numbers/running-numbers.module'; 
// 🌟 [NEW] Import โมดูล Workflow Request เข้ามาทำงานร่วมกัน
import { WfRequestModule } from '../../workflow/requests/wf-request.module';

@Module({
  imports: [
    PrismaModule,        
    OrdersModule,        
    RunningNumbersModule,
    // 🛡️ [FIXED] ป้องกันงูกินหาง (Circular Dependency) ระหว่างโมดูลจัดซื้อกับ Workflow
    forwardRef(() => WfRequestModule) 
  ],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService],
  exports: [PurchaseOrdersService], 
})
export class PurchaseOrdersModule {}