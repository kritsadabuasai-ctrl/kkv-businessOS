import { Module, forwardRef } from '@nestjs/common';
import { WfActionController } from './wf-action.controller';
import { WfActionService } from './wf-action.service';
import { PrismaModule } from '../../../prisma/prisma.module';
// 🌟 1. นำเข้า WfRequestModule
import { WfRequestModule } from '../requests/wf-request.module';

@Module({
  imports: [
    PrismaModule, 
    // 🌟 2. ใช้ forwardRef ป้องกันงูกินหาง
    forwardRef(() => WfRequestModule)
  ], 
  controllers: [WfActionController],
  providers: [WfActionService],
  exports: [WfActionService] 
})
export class WfActionModule {}