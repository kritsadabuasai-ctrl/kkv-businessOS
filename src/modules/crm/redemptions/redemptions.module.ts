import { Module, forwardRef } from '@nestjs/common';
import { RedemptionsService } from './redemptions.service';
import { RedemptionsController } from './redemptions.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { PointLogsModule } from '../point-logs/point-logs.module';
// 🌟 [NEW] นำเข้าโมดูล Workflow Request เข้ามาทำงานร่วมกัน
import { WfRequestModule } from '../../workflow/requests/wf-request.module';

@Module({
  imports: [
    PrismaModule,
    PointLogsModule,
    // 🛡️ [FIXED] ป้องกันงูกินหาง (Circular Dependency) ระหว่างโมดูลด้วย forwardRef()
    forwardRef(() => WfRequestModule), // 👈 ตัวนี้จะทำให้ระบบหลังบ้านรันผ่านฉลุย ไม่แครชตอน Start ครับ
  ],
  controllers: [RedemptionsController],
  providers: [RedemptionsService],
  exports: [RedemptionsService], // 🌟 ส่งออก Service เพื่อให้ฝั่ง Workflow นำไปเรียกทำ Business Hook ได้
})
export class RedemptionsModule {}