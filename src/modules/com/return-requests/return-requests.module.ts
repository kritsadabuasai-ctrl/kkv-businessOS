import { Module, forwardRef } from '@nestjs/common';
import { ReturnRequestsService } from './return-requests.service';
import { ReturnRequestsController } from './return-requests.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { RunningNumbersModule } from '../../cfg/running-numbers/running-numbers.module';
// 🌟 [NEW] Import WfRequestModule เข้ามาเพื่อเตรียมใช้งานร่วมกัน
import { WfRequestModule } from '../../workflow/requests/wf-request.module';

@Module({
  imports: [
    PrismaModule,
    RunningNumbersModule,
    // 🛡️ ป้องกันงูกินหาง (Circular Dependency) ระหว่างโมดูลด้วย forwardRef()
    forwardRef(() => WfRequestModule), // 👈 เพิ่มบรรทัดนี้ไว้ ปลอดภัยแน่นอนครับ
  ],
  controllers: [ReturnRequestsController],
  providers: [ReturnRequestsService],
  exports: [ReturnRequestsService], 
})
export class ReturnRequestsModule {}